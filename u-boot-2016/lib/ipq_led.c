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
#include <fdtdec.h>
#include <dt-bindings/gpio/gpio.h>
#include <ipq_led.h>

typedef struct {
	unsigned int gpio;
	unsigned int active_level;
} led_info_t;

static struct {
	const char *label;
	led_info_t info;
} last_used_led;

DECLARE_GLOBAL_DATA_PTR;

static int led_get_info_by_label(const char *led_label, led_info_t *led_info)
{
	int parent, node;
	int ret, strings_count;
	const char *node_label;

	if (!led_label)
		return -EINVAL;

	if (last_used_led.label && !strcmp(last_used_led.label, led_label)) {
		led_info->gpio = last_used_led.info.gpio;
		led_info->active_level = last_used_led.info.active_level;
		return 0;
	}

	parent = fdt_path_offset(gd->fdt_blob, "/tlmm-gpio/led_gpio");
	if (parent < 0)
		return -ENOENT;

	fdt_for_each_subnode(gd->fdt_blob, node, parent) {
		strings_count = fdt_count_strings(gd->fdt_blob, node, "label");
		for (int i = 0; i < strings_count; i++) {
			node_label = NULL;
			ret = fdt_get_string_index(gd->fdt_blob, node, "label", i, &node_label);
			if (!ret && node_label && !strcmp(node_label, led_label)) {
				led_info->gpio = fdtdec_get_uint(gd->fdt_blob, node, "gpio", 0);
				led_info->active_level = fdtdec_get_uint(gd->fdt_blob, node, "active_level", GPIO_ACTIVE_HIGH);
				return 0;
			}
		}
	}

	return -ENOENT;
}

static int led_get_out_value(led_op_t op, unsigned int gpio,
        unsigned int active_level, unsigned int *value)
{
    if (!value)
        return -EINVAL;

	switch(op) {
	case LED_OP_ON:
		*value = (active_level == GPIO_ACTIVE_HIGH) ? GPIO_OUT_HIGH : GPIO_OUT_LOW;
        break;
	case LED_OP_OFF:
		*value = (active_level == GPIO_ACTIVE_HIGH) ? GPIO_OUT_LOW : GPIO_OUT_HIGH;
        break;
	case LED_OP_TOGGLE:
		*value = !gpio_get_value(gpio);
        break;
	default:
		return -EINVAL;
	}

    return 0;
}

void led_control(led_op_t op, const char *label)
{
	int ret;
	led_info_t led;
    unsigned int value;

	ret = led_get_info_by_label(label, &led);
	if (ret || !led.gpio)
		return;

    ret = led_get_out_value(op, led.gpio, led.active_level, &value);
    if (ret)
        return;

	gpio_set_value(led.gpio, value);

	last_used_led.label = label;
	last_used_led.info.gpio = led.gpio;
	last_used_led.info.active_level = led.active_level;
}

void led_control_all(led_op_t op)
{
	int parent, node;
	unsigned int gpio, active_level, value;

	parent = fdt_path_offset(gd->fdt_blob, "/tlmm-gpio/led_gpio");
	if (parent < 0)
		return;

	fdt_for_each_subnode(gd->fdt_blob, node, parent) {
		gpio = fdtdec_get_uint(gd->fdt_blob, node, "gpio", 0);
		active_level = fdtdec_get_uint(gd->fdt_blob, node, "active_level", GPIO_ACTIVE_HIGH);
		if (gpio && !led_get_out_value(op, gpio, active_level, &value))
            gpio_set_value(gpio, value);
	}
}
