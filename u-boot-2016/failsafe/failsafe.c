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
#include <linux/stringify.h>
#include <asm/arch-qca-common/smem.h>
#include <failsafe/failsafe.h>
#include <ipq_api.h>
#if defined(CONFIG_DHCPD)
#include <net/dhcpd.h>
#endif
#include "fs.h"
#include "modules/backup.h"
#include "modules/env.h"
#include "modules/mibib.h"
#include "modules/sysinfo.h"

#if defined(CONFIG_HTTPD_DEBUG)
int httpd_debug_state;
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

int __weak failsafe_validate_image(const int upgrade_type, const void *data_addr,
			const ulong data_size_in_bytes, struct httpd_response *response)
{
	return RET_SUCCESS;
}

int __weak failsafe_write_image(const int upgrade_type, const ulong data_addr,
				const ulong data_size, struct httpd_response *response)
{
	return RET_FAILURE;
}

static int gunzip_and_send(struct httpd_response *response,
				const struct fs_desc *file,
				const char *filename)
{
	void *dst = NULL;
	ulong len = file->uncompressed_size;

	httpd_debug("[DEBUG] %s(): gunzipping %s (%u -> %u bytes)\n",
           __func__, filename, file->size, file->uncompressed_size);

#if defined(CONFIG_GZIP)
	dst = malloc(file->uncompressed_size);
	if (!dst) {
		printf("Error: Failed to allocate %u bytes for gunzip of %s\n",
			   file->uncompressed_size, filename);
        return -1;
	}

	if (gunzip(dst, file->uncompressed_size, (unsigned char *)file->data, &len) != 0) {
		printf("Error: Failed to gunzip %s\n", filename);
		printf("  - gzip_data: %p\n", file->data);
		printf("  - gzip_size: %u\n", file->size);
        printf("  - uncompressed_size: %u\n", file->uncompressed_size);
		free(dst);
		return -1;
	}
#else
	printf("Error: Failed to gunzip %s because the gunzip module is not enabled\n", filename);
	return -1;
#endif

	if (len != file->uncompressed_size)
        printf("Warning: %s uncompressed size mismatch (expect: %u bytes, in fact: %lu bytes)\n",
               filename, file->uncompressed_size, len);

	response->data = dst;
	response->size = len;
	response->info.content_encoding = NULL;
	response->info.content_length = len;
	response->gunzip_buffer = dst;  /* 使用gunzip_buffer指针存储需要释放的内存地址 */

	return 0;
}

static int output_plain_file(struct httpd_response *response,
				const char *filename)
{
	const struct fs_desc *file;

	response->status = HTTP_RESP_STD;
	response->info.connection_close = 1;
	response->gunzip_buffer = NULL;

	file = fs_find_file(filename);

	/* 找不到文件 */
	if (!file) {
		response->data = "Error: file not found";
		response->size = strlen(response->data);
		response->info.code = 404;
		response->info.content_type = "text/html";
		response->info.content_encoding = NULL;

		return 1;
	}

	response->info.code = 200;
	response->info.content_type = file->content_type;

	/* 文件本身就是未压缩的，直接发送 */
	if (!file->is_gzip) {
		response->data = file->data;
		response->size = file->size;
		response->info.content_encoding = NULL;
		response->info.content_length = file->size;
		return 0;
	}

	/* 检查客户端是否支持gzip */
	int client_accepts_gzip = 0;
	const char *accept_encoding = httpd_find_header("Accept-Encoding");

	if (accept_encoding && strstr(accept_encoding, "gzip"))
		client_accepts_gzip = 1;

	/* 客户端支持gzip，直接发送压缩数据 */
	if (client_accepts_gzip) {
		response->data = file->data;
		response->size = file->size;
		response->info.content_encoding = "gzip";
		response->info.content_length = file->size;
		response->info.vary = "Accept-Encoding";

		return 0;
	}

	/* 客户端不支持gzip，需要解压后发送 */
	if (gunzip_and_send(response, file, filename) != 0) {
		/* 解压失败，回退到发送压缩版本？或者返回错误 */
		/* 这里选择返回错误页面 */
		response->data = "Error: Failed to decompress file";
		response->size = strlen(response->data);
		response->info.content_encoding = NULL;
		response->info.content_length = response->size;
		response->info.code = 500;
		response->info.content_type = "text/html";

		return 1;
	}

	return 0;
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

struct upload_session {
	char header_buf[4096];
	int ret;
    int body_sent;
};

static void upload_handler(enum httpd_uri_handler_status status,
				struct httpd_request *request,
				struct httpd_response *response)
{
	struct httpd_form_value *form_value;
	struct upload_session *sess;

	if (status == HTTP_CB_NEW) {
		sess = calloc(1, sizeof(*sess));
		if (!sess) {
			response->info.code = 500;
			return;
		}

		handle_start_led_state();

		response->session_data = sess;

		response->status = HTTP_RESP_CUSTOM;

		response->info.http_1_0 = 1;
		response->info.content_length = -1;
		response->info.connection_close = 1;
		response->info.content_type = "application/json";
		response->info.code = 200;

		response->size = http_make_response_header(&response->info,
							sess->header_buf, sizeof(sess->header_buf));

		response->data = sess->header_buf;

		return;
	}

	if (status == HTTP_CB_RESPONDING) {
		sess = response->session_data;

		if (sess->body_sent) {
			response->status = HTTP_RESP_NONE;
			return;
		}

		/* new upload session identifier */
		fs_upload_id = rand();

		form_value = httpd_request_find_value(request, "firmware");
		if (form_value) {
			upgrade_type = WEBFAILSAFE_UPGRADE_TYPE_FIRMWARE;
			goto done;
		}

		form_value = httpd_request_find_value(request, "uboot");
		if (form_value) {
			upgrade_type = WEBFAILSAFE_UPGRADE_TYPE_UBOOT;
			goto done;
		}

		form_value = httpd_request_find_value(request, "art");
		if (form_value) {
			upgrade_type = WEBFAILSAFE_UPGRADE_TYPE_ART;
			goto done;
		}

		form_value = httpd_request_find_value(request, "cdt");
		if (form_value) {
			upgrade_type = WEBFAILSAFE_UPGRADE_TYPE_CDT;
			goto done;
		}

		form_value = httpd_request_find_value(request, "ptable");
		if (form_value) {
			upgrade_type = WEBFAILSAFE_UPGRADE_TYPE_PTABLE;
			goto done;
		}

		form_value = httpd_request_find_value(request, "simg");
		if (form_value) {
			upgrade_type = WEBFAILSAFE_UPGRADE_TYPE_SIMG;
			goto done;
		}

		form_value = httpd_request_find_value(request, "initramfs");
		if (form_value) {
			upgrade_type = WEBFAILSAFE_UPGRADE_TYPE_INITRAMFS;
			goto done;
		}

		httpd_debug("[DEBUG] %s(): NOT supported upgrade type!\n", __func__);

		/* 没有匹配的 upgrade_type，返回 fail*/
		response->data = "{\"status\":\"fail\","
						"\"info\":{\"type\":\"wrong_upgrade_type\"}}";
		response->size = strlen(response->data);
		sess->body_sent = 1;

		httpd_debug("[DEBUG] %s(): response message: %s\n", __func__, response->data);

		return;

	done:
		upload_data_id = fs_upload_id;
		upload_data = form_value->data;
		upload_size = form_value->size;

		httpd_debug("[DEBUG] %s(): upload_data = 0x%p, upload_size = %lu (0x%lx)\n",
					__func__, upload_data, (ulong)upload_size, (ulong)upload_size);

		sess->ret = failsafe_validate_image(upgrade_type,
						upload_data, (ulong)upload_size, response);

		sess->body_sent = 1;

		httpd_debug("[DEBUG] %s(): response message: %s\n", __func__, response->data);

		return;
	}

	if (status == HTTP_CB_CLOSED) {
		sess = response->session_data;

		if (sess->ret == RET_SUCCESS)
			handle_success_led_state();
		else
			handle_fail_led_state();

		free(response->session_data);
	}
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
	static char resp[256];
	struct flashing_status *st;
	u32 size;

	if (status == HTTP_CB_NEW) {
		st = calloc(1, sizeof(*st));
		if (!st) {
			response->info.code = 500;
			return;
		}

		handle_start_led_state();

		st->ret = RET_FAILURE;

		response->session_data = st;

		response->status = HTTP_RESP_CUSTOM;

		response->info.http_1_0 = 1;
		response->info.content_length = -1;
		response->info.connection_close = 1;
		response->info.content_type = "application/json";
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
				st->ret = failsafe_write_image(upgrade_type, (ulong)upload_data,
								(ulong)upload_size, response);
		} else {
			snprintf(resp, sizeof(resp),
				"{\"status\":\"fail\","
				"\"info\":{\"type\":\"upload_id_mismatch\","
				"\"upload_data_id\":\"%u\",\"fs_upload_id\":\"%u\"}}",
				upload_data_id, fs_upload_id);
			response->data = resp;
			st->ret = RET_UPLOAD_ID_MISMATCH;
		}

		/* invalidate upload identifier */
		upload_data_id = rand();

		if (st->ret == RET_SUCCESS)
			response->data = "{\"status\":\"success\"}";

		response->size = strlen(response->data);
		st->body_sent = 1;

		httpd_debug("[DEBUG] %s(): response message: %s\n", __func__, response->data);

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
		else
			handle_fail_led_state();
	}
}

static void style_handler(enum httpd_uri_handler_status status,
				struct httpd_request *request,
				struct httpd_response *response)
{
	if (status == HTTP_CB_NEW)
		output_plain_file(response, "style.css");
}

static void js_handler(enum httpd_uri_handler_status status,
	struct httpd_request *request,
	struct httpd_response *response)
{
	if (status == HTTP_CB_NEW)
		output_plain_file(response, "main.js");
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

	handle_start_led_state();

	httpd_register_uri_handler(inst, "/", &index_handler, NULL);
	httpd_register_uri_handler(inst, "/cgi-bin/luci", &index_handler, NULL);
	httpd_register_uri_handler(inst, "/cgi-bin/luci/", &index_handler, NULL);

	httpd_register_uri_handler(inst, "/booting.html", &html_handler, NULL);
	httpd_register_uri_handler(inst, "/flashing.html", &html_handler, NULL);
	httpd_register_uri_handler(inst, "/art.html", &html_handler, NULL);
	httpd_register_uri_handler(inst, "/cdt.html", &html_handler, NULL);
	httpd_register_uri_handler(inst, "/ptable.html", &html_handler, NULL);
	httpd_register_uri_handler(inst, "/simg.html", &html_handler, NULL);
	httpd_register_uri_handler(inst, "/initramfs.html", &html_handler, NULL);
	httpd_register_uri_handler(inst, "/reboot.html", &html_handler, NULL);
	httpd_register_uri_handler(inst, "/uboot.html", &html_handler, NULL);

	httpd_register_uri_handler(inst, "/main.js", &js_handler, NULL);
	httpd_register_uri_handler(inst, "/style.css", &style_handler, NULL);

	httpd_register_uri_handler(inst, "/reboot", &reboot_handler, NULL);
	httpd_register_uri_handler(inst, "/result", &result_handler, NULL);
	httpd_register_uri_handler(inst, "/upload", &upload_handler, NULL);
	httpd_register_uri_handler(inst, "/version", &version_handler, NULL);

	httpd_register_uri_handler(inst, "/mibib.html", &html_handler, NULL);
	httpd_register_uri_handler(inst, "/mibib/reload", &mibib_reload_handler, NULL);

	httpd_register_uri_handler(inst, "/sysinfo.html", &html_handler, NULL);
	httpd_register_uri_handler(inst, "/sysinfo", &sysinfo_handler, NULL);

	httpd_register_uri_handler(inst, "/backup.html", &html_handler, NULL);
	httpd_register_uri_handler(inst, "/backup", &backup_handler, NULL);

	httpd_register_uri_handler(inst, "/env.html", &html_handler, NULL);
	httpd_register_uri_handler(inst, "/env/list", &env_list_handler, NULL);
	httpd_register_uri_handler(inst, "/env/set", &env_set_handler, NULL);
	httpd_register_uri_handler(inst, "/env/unset", &env_unset_handler, NULL);
	httpd_register_uri_handler(inst, "/env/reset", &env_reset_handler, NULL);
	httpd_register_uri_handler(inst, "/env/restore", &env_restore_handler, NULL);

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

static int do_httpd(cmd_tbl_t *cmdtp, int flag, int argc, char * const argv[])
{
	u32 local_ip;
	int ret;

#if defined(CONFIG_HTTPD_DEBUG)
	if (getenv("httpd_debug") || is_9008_mode)
		httpd_debug_state = 1;
	else
		httpd_debug_state = 0;
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
		handle_success_led_state();
		mdelay(1000);
		if (upgrade_type == WEBFAILSAFE_UPGRADE_TYPE_INITRAMFS)
			boot_from_mem((ulong)upload_data);
		else
			do_reset(NULL, 0, 0, NULL);
	} else {
		handle_fail_led_state();
	}

	return ret;
}

U_BOOT_CMD(httpd, 1, 0, do_httpd,
	"Start failsafe HTTP server, no argument needed",
	""
);
