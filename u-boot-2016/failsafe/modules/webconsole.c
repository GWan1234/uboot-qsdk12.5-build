// SPDX-License-Identifier: GPL-2.0
/*
 * Copyright (C) 2026 chenxin527. All Rights Reserved.
 *
 * This file is part of the project uboot-qsdk12.5-build
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, see <http://www.gnu.org/licenses/>.
 */

#include <common.h>
#include <malloc.h>
#include <errno.h>
#include <net/httpd.h>
#include <ipq_api.h>
#include <mmc.h>
#include <sdhci.h>
#include <part.h>
#include <u-boot/md5.h>
#include <failsafe/fw_dec.h>
#include <capture.h>

#include "webconsole.h"

#ifndef CONFIG_SDHCI_SUPPORT
extern qca_mmc mmc_host;
#else
extern struct sdhci_host mmc_host;
#endif

#define WEBCONSOLE_MAX_CMD_SIZE				256
#define WEBCONSOLE_RECORD_OUT_SIZE			16666
#define WEBCONSOLE_UPLOAD_FILE_INFO_SIZE	999

/* Implemented in u-boot-2016/common/cli_hush.c */
extern bool is_last_command_repeatable(void);
extern void webconsole_init_repeat_flag(void);
extern void webconsole_repeat_last_command(bool repeat);

static struct {
	char data[WEBCONSOLE_MAX_CMD_SIZE + 1];
	bool repeatable;
} command = { .repeatable = false };

static void handle_response_message(struct httpd_response *response,
    int code, const char *data, int data_size, const char *content_type)
{
	response->status = HTTP_RESP_STD;
	response->data = data ? data : "";
	response->size = (data_size != -1) ? data_size : strlen(response->data);
	response->info.code = code;
	response->info.connection_close = 1;
	response->info.content_type = content_type ? content_type : "text/plain";
}

static void webconsole_free_session_data(struct httpd_response *response)
{
	if (response->session_data) {
		free(response->session_data);
		response->session_data = NULL;
	}
}

static int webconsole_run_command(void *cmd)
{
	return run_command((const char *)cmd, 0);
}

void webconsole_exec_handler(enum httpd_uri_handler_status status,
	struct httpd_request *request,
	struct httpd_response *response)
{
	struct httpd_form_value *raw_cmd;
	const char *echo_str = "";
	const char *do_repeat_str = "__DO_REPEAT__";
	const char *cancel_repeat_str = "__CANCEL_REPEAT__";
	char *buf;
	size_t out_len = 0;
	int ret;

	if (status == HTTP_CB_CLOSED) {
		webconsole_free_session_data(response);
		return;
	}

	if (status != HTTP_CB_NEW)
		return;

	response->session_data = NULL;

	if (!request || request->method != HTTP_POST) {
		handle_response_message(response, 405, "bad method", -1, NULL);
		return;
	}

	raw_cmd = httpd_request_find_value(request, "cmd");
	if (!raw_cmd || !raw_cmd->data || !raw_cmd->size) {
		handle_response_message(response, 400, "no cmd", -1, NULL);
		return;
	}

	if (raw_cmd->size == strlen(do_repeat_str) &&
		!strcmp(raw_cmd->data, do_repeat_str)) {
		if (!command.repeatable) {
			handle_response_message(response, 200, "", -1, NULL);
			return;
		}
		webconsole_repeat_last_command(true);
		echo_str = "<REPEAT>";
	} else if (raw_cmd->size == strlen(cancel_repeat_str) &&
		!strcmp(raw_cmd->data, cancel_repeat_str)) {
		command.repeatable = false;
		webconsole_repeat_last_command(false);
		handle_response_message(response, 200, "", -1, NULL);
		return;
	} else {
		strlcpy(command.data, raw_cmd->data, sizeof(command.data));
		webconsole_init_repeat_flag();
		webconsole_repeat_last_command(false);
		echo_str = command.data;
	}

	buf = malloc(WEBCONSOLE_RECORD_OUT_SIZE);
	if (!buf) {
		handle_response_message(response, 500, "no mem", -1, NULL);
		return;
	}

	printf("\nIPQ# %s\n", echo_str);

	ret = call_func_capture(webconsole_run_command, command.data,
			buf, WEBCONSOLE_RECORD_OUT_SIZE, &out_len);

	command.repeatable = (!ret && is_last_command_repeatable()) ? true : false;

	handle_response_message(response, 200, buf, out_len, NULL);
	response->session_data = buf;
}

static int print_file_info(void *arg)
{
	struct httpd_form_value *file;
	unsigned char md5_sum[16];
	const char *separator;
	fw_type_t fw_type;

	file = arg;
	fw_type = check_fw_type((uintptr_t)file->data, file->size);
	md5((unsigned char *)file->data, file->size, md5_sum);

	separator = "\n=================================="
				"=========================================\n";

	puts(separator);
	printf(" [FILE] %s\n", file->filename);
	printf(" [TYPE] %s\n", fw_type_to_string(fw_type));
	printf(" [ADDR] 0x%lx\n", (ulong)file->data);

	printf(" [SIZE] 0x%lx (", (ulong)file->size);
	print_size(file->size, ")\n");

	puts(" [ MD5] ");
	for (int i = 0; i < 16; i++)
		printf("%02x", md5_sum[i] & 0xFF);
	puts(separator);

	return 0;
}

void webconsole_upload_handler(enum httpd_uri_handler_status status,
	struct httpd_request *request,
	struct httpd_response *response)
{
	struct httpd_form_value *file;
	block_dev_desc_t *mmc_dev;
	const detected_flash_device_t *dfd = &detected_flash_device;
	ulong size_blocks;
	char *buf;
	size_t len = 0;

	if (status == HTTP_CB_CLOSED) {
		webconsole_free_session_data(response);
		return;
	}

	if (status != HTTP_CB_NEW)
		return;

	response->session_data = NULL;

	file = httpd_request_find_value(request, "file");
	if (!file || !file->data) {
		handle_response_message(response, 400, "no file", -1, NULL);
		return;
	}

	setenv_hex("fileaddr", (ulong)file->data);
    setenv_hex("filesize", (ulong)file->size);
    if (dfd->mmc) {
        mmc_dev = mmc_get_dev(mmc_host.dev_num);
        if (mmc_dev && mmc_dev->blksz) {
            size_blocks = file->size / mmc_dev->blksz +
                            (file->size % mmc_dev->blksz != 0);
            setenv_hex("filesize_blks", size_blocks);
        }
    }

	buf = malloc(WEBCONSOLE_UPLOAD_FILE_INFO_SIZE);
	if (buf) {
		call_func_capture(print_file_info, file,
			buf, WEBCONSOLE_UPLOAD_FILE_INFO_SIZE, &len);
		handle_response_message(response, 200, buf, len, NULL);
		response->session_data = buf;
	} else {
		handle_response_message(response, 200,
			"\n============================\n"
			" File uploaded successfully"
			"\n============================\n", -1, NULL);
	}
}

void webconsole_cmdlist_handler(enum httpd_uri_handler_status status,
	struct httpd_request *request,
	struct httpd_response *response)
{
	cmd_tbl_t *cmd_start = ll_entry_start(cmd_tbl_t, cmd);
	const int cmd_items = ll_entry_count(cmd_tbl_t, cmd);
	int len = 0, left = 6666;
	char *buf;
	char esc_cmd_usage[512];

	if (status == HTTP_CB_CLOSED) {
		webconsole_free_session_data(response);
		return;
	}

	if (status != HTTP_CB_NEW)
		return;

	response->session_data = NULL;

	if (!request || request->method != HTTP_GET) {
		handle_response_message(response, 405, "bad method", -1, NULL);
		return;
	}

	buf = malloc(left);
	if (!buf) {
		handle_response_message(response, 500, "no mem", -1, NULL);
		return;
	}

	len += snprintf(buf + len, left - len, "{");
	len += snprintf(buf + len, left - len, "\"cmdlist\": [");

	for (int i = 0; i < cmd_items; i++) {
		json_escape(cmd_start[i].usage, esc_cmd_usage, sizeof(esc_cmd_usage));
		len += snprintf(buf + len, left - len,
			"%s{\"name\":\"%s\",\"usage\":\"%s\"}",
			i ? "," : "", cmd_start[i].name, esc_cmd_usage);
	}

	len += snprintf(buf + len, left - len, "]");
	len += snprintf(buf + len, left - len, "}");

	handle_response_message(response, 200, buf, -1, "application/json");
	response->session_data = buf;
}
