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
#include <errno.h>
#include <capture.h>

DECLARE_GLOBAL_DATA_PTR;

struct capture_buffer {
	char *buf;
	size_t buf_size;
	size_t pos;
};

static struct capture_buffer capture_out;
static struct capture_buffer *p = &capture_out;

void capture_putc(const char c)
{
	if (p->buf && p->pos < p->buf_size - 1) {
		p->buf[p->pos++] = c;
		p->buf[p->pos] = '\0';
	}
}

void capture_puts(const char *s)
{
	size_t s_len, avail_len, cpy_len;

	if (p->buf && p->pos < p->buf_size - 1) {
		s_len = strlen(s);
		avail_len = p->buf_size - p->pos - 1;
		cpy_len = min(s_len, avail_len);

		memcpy(p->buf + p->pos, s, cpy_len);
		p->pos += cpy_len;
		p->buf[p->pos] = '\0';
	}
}

int call_func_capture(int (*func)(void *), void *arg,
        char *buf, size_t buf_size, size_t *len)
{
    int ret;

    if (!func || !buf || !buf_size)
        return -EINVAL;

    p->buf = buf;
    p->buf[0] = '\0';
    p->buf_size = buf_size;
    p->pos = 0;

    gd->flags |= GD_FLG_CAPTURE;

    ret = func(arg);

    gd->flags &= ~GD_FLG_CAPTURE;

    p->buf = NULL;

    if (len)
        *len = p->pos;

    return ret;
}
