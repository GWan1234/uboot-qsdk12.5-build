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
#include <failsafe/fw.h>

#include "webconsole.h"

#ifndef CONFIG_SDHCI_SUPPORT
extern qca_mmc mmc_host;
#else
extern struct sdhci_host mmc_host;
#endif

DECLARE_GLOBAL_DATA_PTR;

#define WEBCONSOLE_MAX_CMD_SIZE				256
#define WEBCONSOLE_RECORD_OUT_SIZE			9999
#define WEBCONSOLE_UPLOAD_FILE_INFO_SIZE	999

struct webconsole_buffer {
	char *buf;
	size_t buf_size;
	size_t pos;
};

static bool webconsole_record_on = false;
static struct webconsole_buffer webconsole_out;

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

void webconsole_putc(const char c)
{
	struct webconsole_buffer *p = &webconsole_out;

	if (!webconsole_record_on || p->buf == NULL)
		return;

	if (p->pos < p->buf_size - 1) {
		p->buf[p->pos++] = c;
		p->buf[p->pos] = '\0';
	}
}

void webconsole_puts(const char *s)
{
	struct webconsole_buffer *p = &webconsole_out;
	size_t s_len, avail_len, cpy_len;

	if (!webconsole_record_on || p->buf == NULL)
		return;

	if (p->pos < p->buf_size - 1) {
		s_len = strlen(s);
		avail_len = p->buf_size - p->pos - 1;
		cpy_len = min(s_len, avail_len);

		memcpy(p->buf + p->pos, s, cpy_len);
		p->pos += cpy_len;
		p->buf[p->pos] = '\0';
	}
}

int webconsole_record_init(size_t buf_size)
{
	struct webconsole_buffer *p = &webconsole_out;

	p->buf = malloc(buf_size);
	if (p->buf == NULL)
		return -ENOMEM;

	p->buf[0] = '\0';
	p->buf_size = buf_size;
	p->pos = 0;

	return 0;
}

void webconsole_free_buffer(void *buf)
{
	if (buf) {
		free(buf);
		buf = NULL;
	}
}

void webconsole_exec_handler(enum httpd_uri_handler_status status,
	struct httpd_request *request,
	struct httpd_response *response)
{
	struct webconsole_buffer *p = &webconsole_out;
	struct httpd_form_value *raw_cmd;
	char cmd[WEBCONSOLE_MAX_CMD_SIZE + 1];

	if (status == HTTP_CB_CLOSED) {
		webconsole_free_buffer(webconsole_out.buf);
		return;
	}

	if (status != HTTP_CB_NEW)
		return;

	if (!request || request->method != HTTP_POST) {
		handle_response_message(response, 405, "bad method", -1, NULL);
		return;
	}

	raw_cmd = httpd_request_find_value(request, "cmd");
	if (!raw_cmd || !raw_cmd->data || !raw_cmd->size) {
		handle_response_message(response, 400, "no cmd", -1, NULL);
		return;
	}

	memset(cmd, 0, sizeof(cmd));
	memcpy(cmd, raw_cmd->data, min_t(size_t, WEBCONSOLE_MAX_CMD_SIZE, raw_cmd->size));

	if (webconsole_record_init(WEBCONSOLE_RECORD_OUT_SIZE)) {
		handle_response_message(response, 500, "no mem", -1, NULL);
		return;
	}

	webconsole_record_on = true;

	printf("\nIPQ# %s\n", cmd);

	run_command(cmd, 0);

	webconsole_record_on = false;

	handle_response_message(response, 200, p->buf, p->pos, NULL);
}

void webconsole_upload_handler(enum httpd_uri_handler_status status,
	struct httpd_request *request,
	struct httpd_response *response)
{
	struct webconsole_buffer *p = &webconsole_out;
	struct httpd_form_value *file;
	block_dev_desc_t *mmc_dev;
	detected_flash_device_t *dfd = &detected_flash_device;
	ulong size_blocks;
	unsigned char md5_sum[16];
	const char *separator;
	int ret, fw_type;

	if (status == HTTP_CB_CLOSED) {
		webconsole_free_buffer(webconsole_out.buf);
		return;
	}

	if (status != HTTP_CB_NEW)
		return;

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

	fw_type = check_fw_type((const void *)file->data);
	md5((unsigned char *)file->data, file->size, md5_sum);

	ret = webconsole_record_init(WEBCONSOLE_UPLOAD_FILE_INFO_SIZE);

	if (!ret)
		webconsole_record_on = true;

	separator = "\n===========================================================================\n";

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

	if (!ret) {
		webconsole_record_on = false;
		handle_response_message(response, 200, p->buf, p->pos, NULL);
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
		webconsole_free_buffer(response->session_data);
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
