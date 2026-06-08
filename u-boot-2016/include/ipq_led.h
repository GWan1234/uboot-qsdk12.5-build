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

#ifndef __IPQ_LED__
#define __IPQ_LED__

typedef enum {
	LED_OP_ON,
	LED_OP_OFF,
	LED_OP_TOGGLE
} led_op_t;

void led_control(led_op_t op, const char *label);
void led_control_all(led_op_t op);

static inline void led_on(const char *label)
{
	led_control(LED_OP_ON, label);
}

static inline void led_off(const char *label)
{
	led_control(LED_OP_OFF, label);
}

static inline void led_toggle(const char *label)
{
	led_control(LED_OP_TOGGLE, label);
}

static inline void led_all_on(void)
{
	led_control_all(LED_OP_ON);
}

static inline void led_all_off(void)
{
	led_control_all(LED_OP_OFF);
}

static inline void led_all_toggle(void)
{
	led_control_all(LED_OP_TOGGLE);
}

#endif /* __IPQ_LED__ */
