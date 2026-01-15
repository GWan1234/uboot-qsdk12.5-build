/* SPDX-License-Identifier: GPL-2.0 */
/*
 * Copyright (C) 2022 MediaTek Inc. All Rights Reserved.
 *
 * Author: Weijie Gao <weijie.gao@mediatek.com>
 *
 * Failsafe Web UI
 */

#include <common.h>
#include <command.h>
#include <console.h>
#include <malloc.h>
#include <membuff.h>
#include <net.h>
#include <version.h>
#include <net/tcp.h>
#include <net/httpd.h>
#include <u-boot/md5.h>
#include <linux/stringify.h>
#include <failsafe/failsafe.h>
#include <ipq_api.h>
#if defined(CONFIG_DHCPD)
#include <net/dhcpd.h>
#endif
#include "fs.h"

#if defined(CONFIG_HTTPD_DEBUG)
int httpd_debug;
#endif

/*
 * httpd exposes a global symbol named `upload_id`.
 * Avoid colliding with it by using a failsafe-local name.
 */
static u32 fs_upload_id;
static u32 upload_data_id;
static const void *upload_data;
static size_t upload_size;
static bool upgrade_success;
static int upgrade_type;

struct reboot_session {
	int dummy;
};

int __weak boot_from_mem(const ulong data_addr)
{
	return RET_FAILURE;
}

int __weak failsafe_validate_image(const int upgrade_type,
				const void *data_addr, const ulong data_size_in_bytes)
{
	return RET_SUCCESS;
}

int __weak failsafe_write_image(const int upgrade_type,
				const ulong data_addr, const ulong data_size)
{
	return RET_FAILURE;
}

static int output_plain_file(struct httpd_response *response,
	const char *filename)
{
	const struct fs_desc *file;
	int ret = 0;

	file = fs_find_file(filename);

	response->status = HTTP_RESP_STD;

	if (file) {
		response->data = file->data;
		response->size = file->size;
	} else {
		response->data = "Error: file not found";
		response->size = strlen(response->data);
		ret = 1;
	}

	response->info.code = 200;
	response->info.connection_close = 1;
	response->info.content_type = "text/html";

	return ret;
}

static void not_found_handler(enum httpd_uri_handler_status status,
	struct httpd_request *request,
	struct httpd_response *response)
{
	if (status == HTTP_CB_NEW) {
		output_plain_file(response, "404.html");
		response->info.code = 404;
	}
}

static void index_handler(enum httpd_uri_handler_status status,
	struct httpd_request *request,
	struct httpd_response *response)
{
	if (status == HTTP_CB_NEW)
		output_plain_file(response, "index.html");
}

static void html_handler(enum httpd_uri_handler_status status,
	struct httpd_request *request,
	struct httpd_response *response)
{
	if (status != HTTP_CB_NEW)
		return;

	if (output_plain_file(response, request->urih->uri + 1))
		not_found_handler(status, request, response);
}

static void version_handler(enum httpd_uri_handler_status status,
	struct httpd_request *request,
	struct httpd_response *response)
{
	if (status != HTTP_CB_NEW)
		return;

	response->status = HTTP_RESP_STD;

	response->data = version_string;
	response->size = strlen(response->data);

	response->info.code = 200;
	response->info.connection_close = 1;
	response->info.content_type = "text/plain";
}

static void reboot_handler(enum httpd_uri_handler_status status,
			   struct httpd_request *request,
			   struct httpd_response *response)
{
	struct reboot_session *st;

	if (status == HTTP_CB_NEW) {
		st = calloc(1, sizeof(*st));
		if (!st) {
			response->info.code = 500;
			return;
		}

		response->session_data = st;
		response->status = HTTP_RESP_STD;
		response->data = "rebooting";
		response->size = strlen(response->data);
		response->info.code = 200;
		response->info.connection_close = 1;
		response->info.content_type = "text/plain";
		return;
	}

	if (status == HTTP_CB_CLOSED) {
		st = response->session_data;
		free(st);

		/* Make sure the current HTTP session has fully closed before reset */
		tcp_close_all_conn();
		do_reset(NULL, 0, 0, NULL);
	}
}

static void upload_handler(enum httpd_uri_handler_status status,
	struct httpd_request *request,
	struct httpd_response *response)
{
	static char hexchars[] = "0123456789abcdef";
	struct httpd_form_value *fw;
	static char md5_str[33] = "";
	static char resp[128];
	u8 md5_sum[16];
	int ret;

	if (status != HTTP_CB_NEW)
		return;

#if defined(CONFIG_HTTPD_DEBUG)
	if (httpd_debug)
		printf("[DEBUG] upload_handler(): before rand(), fs_upload_id = %u\n", fs_upload_id);
#endif
	/* new upload session identifier */
	fs_upload_id = rand();
#if defined(CONFIG_HTTPD_DEBUG)
	if (httpd_debug)
		printf("[DEBUG] upload_handler(): after rand(), fs_upload_id = %u\n", fs_upload_id);
#endif

	response->status = HTTP_RESP_STD;
	response->info.code = 200;
	response->info.connection_close = 1;
	response->info.content_type = "text/plain";

	fw = httpd_request_find_value(request, "firmware");
	if (fw) {
		upgrade_type = WEBFAILSAFE_UPGRADE_TYPE_FIRMWARE;
		goto done;
	}

	fw = httpd_request_find_value(request, "uboot");
	if (fw) {
		upgrade_type = WEBFAILSAFE_UPGRADE_TYPE_UBOOT;
		goto done;
	}

	fw = httpd_request_find_value(request, "art");
	if (fw) {
		upgrade_type = WEBFAILSAFE_UPGRADE_TYPE_ART;
		goto done;
	}

	fw = httpd_request_find_value(request, "cdt");
	if (fw) {
		upgrade_type = WEBFAILSAFE_UPGRADE_TYPE_CDT;
		goto done;
	}

	fw = httpd_request_find_value(request, "gpt");
	if (fw) {
		upgrade_type = WEBFAILSAFE_UPGRADE_TYPE_GPT;
		goto done;
	}

	fw = httpd_request_find_value(request, "mibib");
	if (fw) {
		upgrade_type = WEBFAILSAFE_UPGRADE_TYPE_MIBIB;
		goto done;
	}

	fw = httpd_request_find_value(request, "simg");
	if (fw) {
		upgrade_type = WEBFAILSAFE_UPGRADE_TYPE_SIMG;
		goto done;
	}

	fw = httpd_request_find_value(request, "initramfs");
	if (fw) {
		upgrade_type = WEBFAILSAFE_UPGRADE_TYPE_INITRAMFS;
		goto done;
	}

#if defined(CONFIG_HTTPD_DEBUG)
	if (httpd_debug)
		printf("[DEBUG] upload_handler(): NOT supported upgrade type!\n");
#endif
	/* 没有匹配的 upgrade_type，返回 fail*/
	response->data = "fail";
	response->size = strlen(response->data);
#if defined(CONFIG_HTTPD_DEBUG)
	if (httpd_debug)
		printf("[DEBUG] upload_handler(): response message: %s\n", response->data);
#endif
	return;

done:
	upload_data_id = fs_upload_id;
	upload_data = fw->data;
	upload_size = fw->size;

#if defined(CONFIG_HTTPD_DEBUG)
	if (httpd_debug)
		printf("[DEBUG] upload_handler(): "
			"upload_data_id = %u, upload_data = 0x%p, upload_size = %lu\n",
			upload_data_id, upload_data, (ulong)upload_size
		);
#endif

	ret = failsafe_validate_image(upgrade_type, upload_data, (ulong)upload_size);
	if (ret != RET_SUCCESS) {
		/* 文件类型不对或文件大小不对 */
		response->data = "fail";
		response->size = strlen(response->data);
#if defined(CONFIG_HTTPD_DEBUG)
		if (httpd_debug)
			printf("[DEBUG] upload_handler(): response message: %s\n", response->data);
#endif
		return;
	}

	md5((u8 *)fw->data, fw->size, md5_sum);

	for (int i = 0; i < 16; i++) {
		u8 hex = (md5_sum[i] >> 4) & 0xf;
		md5_str[i * 2] = hexchars[hex];
		hex = md5_sum[i] & 0xf;
		md5_str[i * 2 + 1] = hexchars[hex];
	}

	sprintf(resp, "%u %s", fw->size, md5_str);

#if defined(CONFIG_HTTPD_DEBUG)
	if (httpd_debug)
		printf("[DEBUG] upload_handler(): md5 for upload file: %s\n", md5_str);
#endif

	response->data = resp;
	response->size = strlen(response->data);

#if defined(CONFIG_HTTPD_DEBUG)
	if (httpd_debug)
		printf("[DEBUG] upload_handler(): response message: %s\n", response->data);
#endif
}

struct flashing_status {
	char buf[4096];
	int ret;
	int body_sent;
};

static void result_handler(enum httpd_uri_handler_status status,
				struct httpd_request *request,
				struct httpd_response *response)
{
	struct flashing_status *st;
	u32 size;

	if (status == HTTP_CB_NEW) {
		st = calloc(1, sizeof(*st));
		if (!st) {
			response->info.code = 500;
			return;
		}

		st->ret = RET_FAILURE;

		response->session_data = st;

		response->status = HTTP_RESP_CUSTOM;

		response->info.http_1_0 = 1;
		response->info.content_length = -1;
		response->info.connection_close = 1;
		response->info.content_type = "text/html";
		response->info.code = 200;

		size = http_make_response_header(&response->info,
			st->buf, sizeof(st->buf));

		response->data = st->buf;
		response->size = size;

		return;
	}

	if (status == HTTP_CB_RESPONDING) {
		st = response->session_data;

		if (st->body_sent) {
			response->status = HTTP_RESP_NONE;
			return;
		}

		if (upload_data_id == fs_upload_id) {
			if (upgrade_type == WEBFAILSAFE_UPGRADE_TYPE_INITRAMFS)
				st->ret = RET_SUCCESS;
			else
				st->ret = failsafe_write_image(upgrade_type, (ulong)upload_data, (ulong)upload_size);
		}

#if defined(CONFIG_HTTPD_DEBUG)
		if (httpd_debug) {
			printf("[DEBUG] result_handler(): st->ret = %d\n", st->ret);
			printf("[DEBUG] result_handler(): before rand(), upload_data_id = %u\n", upload_data_id);
		}
#endif
		/* invalidate upload identifier */
		upload_data_id = rand();
#if defined(CONFIG_HTTPD_DEBUG)
		if (httpd_debug)
			printf("[DEBUG] result_handler(): after rand(), upload_data_id = %u\n", upload_data_id);
#endif

		led_off("system_led");
		led_on("blink_led");

		if (st->ret == RET_SUCCESS)
			response->data = "success";
		else
			// TODO: 更详细的错误类型
			response->data = "failed";

		response->size = strlen(response->data);
		st->body_sent = 1;
		return;
	}

	if (status == HTTP_CB_CLOSED) {
		st = response->session_data;

		if (st->ret == RET_SUCCESS)
			upgrade_success = true;
		else
			upgrade_success = false;

		free(response->session_data);

		if (upgrade_success)
			tcp_close_all_conn();
	}
}

static void style_handler(enum httpd_uri_handler_status status,
				struct httpd_request *request,
				struct httpd_response *response)
{
	if (status == HTTP_CB_NEW) {
		output_plain_file(response, "style.css");
		response->info.content_type = "text/css";
	}
}

static void js_handler(enum httpd_uri_handler_status status,
	struct httpd_request *request,
	struct httpd_response *response)
{
	if (status == HTTP_CB_NEW) {
		output_plain_file(response, "main.js");
		response->info.content_type = "text/javascript";
	}
}

int start_web_failsafe(void)
{
	struct httpd_instance *inst;

	inst = httpd_find_instance(80);
	if (inst)
		httpd_free_instance(inst);

	inst = httpd_create_instance(80);
	if (!inst) {
		printf("Error: failed to create HTTP instance on port 80\n");
		return -1;
	}

	httpd_register_uri_handler(inst, "/", &index_handler, NULL);
	httpd_register_uri_handler(inst, "/cgi-bin/luci", &index_handler, NULL);
	httpd_register_uri_handler(inst, "/cgi-bin/luci/", &index_handler, NULL);

	httpd_register_uri_handler(inst, "/booting.html", &html_handler, NULL);
	httpd_register_uri_handler(inst, "/fail.html", &html_handler, NULL);
	httpd_register_uri_handler(inst, "/flashing.html", &html_handler, NULL);
	httpd_register_uri_handler(inst, "/art.html", &html_handler, NULL);
	httpd_register_uri_handler(inst, "/cdt.html", &html_handler, NULL);
	httpd_register_uri_handler(inst, "/gpt.html", &html_handler, NULL);
	httpd_register_uri_handler(inst, "/mibib.html", &html_handler, NULL);
	httpd_register_uri_handler(inst, "/simg.html", &html_handler, NULL);
	httpd_register_uri_handler(inst, "/initramfs.html", &html_handler, NULL);
	httpd_register_uri_handler(inst, "/reboot.html", &html_handler, NULL);
	httpd_register_uri_handler(inst, "/uboot.html", &html_handler, NULL);

	httpd_register_uri_handler(inst, "/main.js", &js_handler, NULL);

	httpd_register_uri_handler(inst, "/reboot", &reboot_handler, NULL);
	httpd_register_uri_handler(inst, "/result", &result_handler, NULL);
	httpd_register_uri_handler(inst, "/style.css", &style_handler, NULL);
	httpd_register_uri_handler(inst, "/upload", &upload_handler, NULL);
	httpd_register_uri_handler(inst, "/version", &version_handler, NULL);

	httpd_register_uri_handler(inst, "", &not_found_handler, NULL);

#if defined(CONFIG_DHCPD)
	dhcpd_start();
#endif

	net_loop(TCP);

#if defined(CONFIG_DHCPD)
	dhcpd_stop();
#endif

	return 0;
}

#if defined(CONFIG_HTTPD_DEBUG)
static void set_httpd_debug_state(void) {
	char *httpd_debug_str;

	httpd_debug_str = getenv("httpd_debug");

	if (httpd_debug_str == NULL)
		httpd_debug = 0;
	else if (strcmp(httpd_debug_str, "on") == 0)
		httpd_debug = 1;
	else
		httpd_debug = 0;

	return;
}
#endif

static int do_httpd(cmd_tbl_t *cmdtp, int flag, int argc, char * const argv[])
{
	u32 local_ip;
	int ret;

#if defined(CONFIG_HTTPD_DEBUG)
	set_httpd_debug_state();
#endif

#if defined(CONFIG_NET_FORCE_IPADDR)
	net_ip = string_to_ip(__stringify(CONFIG_IPADDR));
	net_netmask = string_to_ip(__stringify(CONFIG_NETMASK));
#endif
	local_ip = ntohl(net_ip.s_addr);

	printf("\nWeb failsafe UI started\n");
	printf("URL: http://%u.%u.%u.%u/\n",
	       (local_ip >> 24) & 0xFF, (local_ip >> 16) & 0xFF,
	       (local_ip >> 8) & 0xFF, local_ip & 0xFF);
	printf("\nPress Ctrl+C to exit\n\n");

	ret = start_web_failsafe();

	if (upgrade_success) {
		if (upgrade_type == WEBFAILSAFE_UPGRADE_TYPE_INITRAMFS)
			boot_from_mem((ulong)upload_data);
		else
			do_reset(NULL, 0, 0, NULL);
	}

	return ret;
}

U_BOOT_CMD(httpd, 1, 0, do_httpd,
	"Start failsafe HTTP server, no argument needed",
	""
);
