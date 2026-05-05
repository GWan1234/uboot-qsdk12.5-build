/* SPDX-License-Identifier: GPL-2.0 */
/*
 * Copyright (C) 2026 Yuzhii0718
 *
 * All rights reserved.
 *
 * This file is part of the project bl-mt798x-dhcpd
 * You may not use, copy, modify or distribute this file except in compliance with the license agreement.
 *
 * Failsafe Web console
 */

/*
 * Modified by: chenxin527
 */

#include <common.h>
#include <command.h>
#include <malloc.h>
#include <console.h>
#include <membuff.h>
#include <errno.h>
#include <net/httpd.h>
#include <ipq_api.h>
#include <mmc.h>
#include <sdhci.h>
#include <part.h>

#include "webconsole.h"

#ifndef CONFIG_SDHCI_SUPPORT
extern qca_mmc mmc_host;
#else
extern struct sdhci_host mmc_host;
#endif

DECLARE_GLOBAL_DATA_PTR;

#define WEB_CONSOLE_CMD_MAX		256
#define WEB_CONSOLE_POLL_MAX	8192

static const char *failsafe_get_prompt(void)
{
	const char *p = getenv("prompt");

	if (p && p[0])
		return p;

#ifdef CONFIG_SYS_PROMPT
	return CONFIG_SYS_PROMPT;
#else
	return "IPQ# ";
#endif
}

static void failsafe_webconsole_free_session(enum httpd_uri_handler_status status,
	struct httpd_response *response)
{
	if (status != HTTP_CB_CLOSED)
		return;

	if (response->session_data) {
		free(response->session_data);
		response->session_data = NULL;
	}
}

int failsafe_webconsole_ensure_recording(void)
{
	int ret;

	if (!gd)
		return -ENODEV;

	if (!gd->console_out.start) {
		ret = console_record_init();
		if (ret)
			return ret;
	}

	gd->flags |= GD_FLG_RECORD;
	return 0;
}

void webconsole_poll_handler(enum httpd_uri_handler_status status,
	struct httpd_request *request,
	struct httpd_response *response)
{
	char *chunk = NULL, *esc = NULL, *json = NULL;
	int ret, avail, want, got;
	size_t esc_sz, json_sz;

	if (status == HTTP_CB_CLOSED) {
		failsafe_webconsole_free_session(status, response);
		return;
	}

	if (status != HTTP_CB_NEW)
		return;

	response->status = HTTP_RESP_STD;
	response->info.code = 200;
	response->info.connection_close = 1;
	response->info.content_type = "application/json";

	if (!request || request->method != HTTP_GET) {
		response->info.code = 405;
		response->data = "{\"error\":\"method\"}\n";
		response->size = strlen(response->data);
		return;
	}

	ret = failsafe_webconsole_ensure_recording();
	if (ret) {
		response->info.code = 503;
		response->data = "{\"error\":\"no_console\"}\n";
		response->size = strlen(response->data);
		return;
	}

	avail = membuff_avail((struct membuff *)&gd->console_out);
	want = min(avail, (int)WEB_CONSOLE_POLL_MAX);

	chunk = malloc(want + 1);
	if (!chunk) {
		response->info.code = 500;
		response->data = "{\"error\":\"oom\"}\n";
		response->size = strlen(response->data);
		return;
	}

	got = want ? membuff_get((struct membuff *)&gd->console_out, chunk, want) : 0;
	chunk[got] = '\0';

	/* Worst case: every char becomes ' ' or escaped with one extra backslash */
	esc_sz = (size_t)got * 2 + 64;
	esc = malloc(esc_sz);
	if (!esc) {
		free(chunk);
		response->info.code = 500;
		response->data = "{\"error\":\"oom\"}\n";
		response->size = strlen(response->data);
		return;
	}

	json_escape(chunk, esc, esc_sz);
	free(chunk);

	json_sz = strlen(esc) + 128;
	json = malloc(json_sz);
	if (!json) {
		free(esc);
		response->info.code = 500;
		response->data = "{\"error\":\"oom\"}\n";
		response->size = strlen(response->data);
		return;
	}

	snprintf(json, json_sz, "{\"data\":\"%s\",\"avail\":%d}\n", esc,
		membuff_avail((struct membuff *)&gd->console_out));
	free(esc);

	response->data = json;
	response->size = strlen(json);
	response->session_data = json;
}

void webconsole_exec_handler(enum httpd_uri_handler_status status,
	struct httpd_request *request,
	struct httpd_response *response)
{
	struct httpd_form_value *cmdv;
	char cmd[WEB_CONSOLE_CMD_MAX + 1];
	char *esc = NULL, *json = NULL;
	int ret;
	size_t esc_sz, json_sz;

	if (status == HTTP_CB_CLOSED) {
		failsafe_webconsole_free_session(status, response);
		return;
	}

	if (status != HTTP_CB_NEW)
		return;

	response->status = HTTP_RESP_STD;
	response->info.code = 200;
	response->info.connection_close = 1;
	response->info.content_type = "application/json";

	if (!request || request->method != HTTP_POST) {
		response->info.code = 405;
		response->data = "{\"error\":\"method\"}\n";
		response->size = strlen(response->data);
		return;
	}

	ret = failsafe_webconsole_ensure_recording();
	if (ret) {
		response->info.code = 503;
		response->data = "{\"error\":\"no_console\"}\n";
		response->size = strlen(response->data);
		return;
	}

	cmdv = httpd_request_find_value(request, "cmd");
	if (!cmdv || !cmdv->data || !cmdv->size) {
		response->info.code = 400;
		response->data = "{\"error\":\"no_cmd\"}\n";
		response->size = strlen(response->data);
		return;
	}

	memset(cmd, 0, sizeof(cmd));
	memcpy(cmd, cmdv->data, min((size_t)WEB_CONSOLE_CMD_MAX, cmdv->size));

	/* Echo to console so browser sees what was executed */
	{
		const char *prompt = failsafe_get_prompt();
		size_t plen = prompt ? strlen(prompt) : 0;
		bool need_space = plen && prompt[plen - 1] != ' ' && prompt[plen - 1] != '\t';

		if (!prompt || !prompt[0])
			prompt = "IPQ# ";

		printf("%s%s%s\n", prompt, need_space ? " " : "", cmd);
	}
	ret = run_command(cmd, 0);
	{
		const char *prompt = failsafe_get_prompt();

		if (!prompt || !prompt[0])
			prompt = "IPQ# ";

		if (prompt[0] != '\n')
			printf("\n%s", prompt);
		else
			printf("%s", prompt);
	}

	esc_sz = strlen(cmd) * 2 + 64;
	esc = malloc(esc_sz);
	if (!esc)
		goto out_oom;

	json_escape(cmd, esc, esc_sz);
	json_sz = strlen(esc) + 128;
	json = malloc(json_sz);
	if (!json)
		goto out_oom;

	snprintf(json, json_sz, "{\"ok\":true,\"ret\":%d,\"cmd\":\"%s\"}\n", ret, esc);
	free(esc);

	response->data = json;
	response->size = strlen(json);
	response->session_data = json;
	return;

out_oom:
	free(esc);
	free(json);
	response->info.code = 500;
	response->data = "{\"error\":\"oom\"}\n";
	response->size = strlen(response->data);
}

void webconsole_clear_handler(enum httpd_uri_handler_status status,
	struct httpd_request *request,
	struct httpd_response *response)
{
	char *json;

	if (status == HTTP_CB_CLOSED) {
		failsafe_webconsole_free_session(status, response);
		return;
	}

	if (status != HTTP_CB_NEW)
		return;

	response->status = HTTP_RESP_STD;
	response->info.code = 200;
	response->info.connection_close = 1;
	response->info.content_type = "application/json";

	if (!request || request->method != HTTP_GET) {
		response->info.code = 405;
		response->data = "{\"error\":\"method\"}\n";
		response->size = strlen(response->data);
		return;
	}

	if (failsafe_webconsole_ensure_recording()) {
		response->info.code = 503;
		response->data = "{\"error\":\"no_console\"}\n";
		response->size = strlen(response->data);
		return;
	}

	console_record_reset();

	json = malloc(64);
	if (!json) {
		response->info.code = 500;
		response->data = "{\"error\":\"oom\"}\n";
		response->size = strlen(response->data);
		return;
	}

	snprintf(json, 64, "{\"ok\":true}\n");
	response->data = json;
	response->size = strlen(json);
	response->session_data = json;
}

void webconsole_upload_handler(enum httpd_uri_handler_status status,
	struct httpd_request *request,
	struct httpd_response *response)
{
	struct httpd_form_value *file;
	block_dev_desc_t *mmc_dev;
	detected_flash_device_t *dfd = &detected_flash_device;
	ulong size_blocks;

	if (status != HTTP_CB_NEW)
		return;

	response->status = HTTP_RESP_STD;
	response->info.connection_close = 1;
	response->info.content_type = "text/plain";

	file = httpd_request_find_value(request, "file");
	if (!file || !file->data) {
		response->data = "no file";
		response->size = strlen(response->data);
		response->info.code = 400;
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

	response->data = "ok";
	response->size = strlen(response->data);
	response->info.code = 200;
}
