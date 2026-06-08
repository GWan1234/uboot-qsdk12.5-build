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

#ifndef __IPQ_API__
#define __IPQ_API__

#include <ipq_led.h>

typedef struct {
	bool spi;
	bool nand;
	bool mmc;
} detected_flash_device_t;

extern detected_flash_device_t detected_flash_device;

#define SZ_KIB(n) ((n) << 10)
#define SZ_MIB(n) ((n) << 20)

/* loadaddr 环境变量的默认值 (u-boot-2016/include/env_default.h) */
#if defined(CONFIG_IPQ40XX)
#define CONFIG_LOADADDR 0x84000000
#else
#define CONFIG_LOADADDR 0x44000000
#endif

/*
 * 每次启动都会检查环境变量：ipaddr、netmask 和 serverip，并将其重置为默认值。
 * 若想要自定义这三个环境变量，需添加 custom_network 环境变量（任意合法非空值即可）。
 */
#define CONFIG_FORCE_NETWORK_ENV

#define CONFIG_TFTP_TSIZE
#if defined(CONFIG_TFTP_TSIZE)
/* tftpboot 和 tftpput 显示数字百分比进度（依赖于 CONFIG_TFTP_TSIZE） */
#define CONFIG_TFTP_DIGITAL_PROGRESS
#endif

#define NO_FLASH_STR         "no"
#define NOR_FLASH_STR        "nor"
#define NAND_FLASH_STR       "nand"
#define ONENAND_FLASH_STR    "onenand"
#define SDC_FLASH_STR        "sdc"
#define MMC_FLASH_STR        "mmc"
#define SPI_FLASH_STR        "spi_nor"
#define NORPLUSNAND_STR      "nor_plus_nand"
#define NORPLUSEMMC_STR      "nor_plus_emmc"
#define QSPI_NAND_FLASH_STR  "qspi_nand"
#define UNKNOWN_FLASH_STR    "unknown"

typedef enum {
    MIBIB_TYPE_NAND,
    MIBIB_TYPE_NOR
} mibib_type_t;

#if defined(CONFIG_FORCE_NETWORK_ENV)
void check_network_settings(void);
#endif
void do_httpd_check(void);
void detect_flash_device(void);
void ipq_gpio_init(void);
size_t json_escape(const char *input, char *output, size_t output_buffer_size);
bool mmc_part_exists(const char *part_name);
const void *get_mibib_ptable_offset(const void *addr, size_t limit, mibib_type_t mibib_type);
void reload_mibib_from_flash_in_9008_mode(void);
void set_default_flash_type_in_9008_mode(void);

#if defined(CONFIG_HTTPD)
const char *flash_type_to_string(const uint32_t flash_type);
int string_to_flash_type(const char *str);
#else
static inline const char *flash_type_to_string(const uint32_t flash_type)
{
	return "";
}

static inline int string_to_flash_type(const char *str)
{
	return -1;
}
#endif

#endif /* __IPQ_API__ */
