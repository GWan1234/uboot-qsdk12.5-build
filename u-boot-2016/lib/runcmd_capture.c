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
#include <command.h>
#include <stdio_dev.h>
#include <runcmd_capture.h>

static struct stdio_dev capture_dev;
static char capture_buffer[CAPTURE_BUFFER_SIZE];
static ulong capture_pos;
static bool dev_registered = false;

static void capture_putc(struct stdio_dev *dev, const char c)
{
    if (capture_pos < sizeof(capture_buffer) - 1) {
        capture_buffer[capture_pos++] = c;
        capture_buffer[capture_pos] = '\0';
    }
}

static void capture_puts(struct stdio_dev *dev, const char *s)
{
    if (capture_pos >= CAPTURE_BUFFER_SIZE - 1)
        return;

    ulong s_len, available_len, copy_len;

    s_len = strlen(s);
    available_len = CAPTURE_BUFFER_SIZE - capture_pos - 1;
    copy_len = min(s_len, available_len);

    memcpy(capture_buffer + capture_pos, s, copy_len);
    capture_pos += copy_len;
    capture_buffer[capture_pos] = '\0';
}

/* 执行命令并捕获输出 */
int run_command_capture(const char *cmd, const char **output)
{
    struct stdio_dev *old_stdout;
    struct stdio_dev *old_stderr;
    int ret;

    memset(&capture_dev, 0, sizeof(capture_dev));
    strcpy(capture_dev.name, "capture");
    capture_dev.flags = DEV_FLAGS_OUTPUT;
    capture_dev.putc = capture_putc;
    capture_dev.puts = capture_puts;

    if (!dev_registered) {
        ret = stdio_register(&capture_dev);
        if (ret) {
            *output = "failed to register capture device\n";
            return run_command(cmd, 0);
        } else {
            dev_registered = true;
        }
    }

    old_stdout = stdio_devices[stdout];
    old_stderr = stdio_devices[stderr];

    stdio_devices[stdout] = &capture_dev;
    stdio_devices[stderr] = &capture_dev;

    capture_pos = 0;
    capture_buffer[0] = '\0';
    *output = capture_buffer;

    ret = run_command(cmd, 0);

    stdio_devices[stdout] = old_stdout;
    stdio_devices[stderr] = old_stderr;

    return ret;
}

static int do_capture_test(cmd_tbl_t *cmdtp, int flag, int argc, char * const argv[])
{
    int ret;
    const char *output;
    ulong buffer_size;

    if (argc != 2)
        return CMD_RET_USAGE;

	ret = run_command_capture(argv[1], &output);

	puts("\n---start---\n");
    puts(output);
    puts("\n---end---\n\n");

    buffer_size = sizeof(capture_buffer);
    printf("capture_pos = %lu\n", capture_pos);
    printf("sizeof(capture_buffer) = %lu\n\n", buffer_size);
    if (capture_pos == buffer_size - 1)
        printf("Warning: the buffer is full, output may be truncated\n\n");

	return ret;
}

U_BOOT_CMD(
	capture_test, 2, 1, do_capture_test,
	"capture_test [command]",
	"run command and capture output\n"
);
