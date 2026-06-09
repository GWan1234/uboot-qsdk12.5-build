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

DECLARE_GLOBAL_DATA_PTR;

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

static inline bool is_load_addr_valid(uintptr_t load_addr)
{
	/*
     * Do not load files to the reserved region or the
     * region where linux is executed.
     */
#ifdef CONFIG_IPQ806X
    if ((load_addr < IPQ_TFTP_MIN_ADDR) || (load_addr >= IPQ_TFTP_MAX_ADDR))
#else
    if ((load_addr < IPQ_TFTP_MIN_ADDR) || (load_addr >= CONFIG_SYS_SDRAM_END) ||
        ((load_addr >= CONFIG_IPQ_FDT_HIGH) && (load_addr < CONFIG_TZ_END_ADDR)))
#endif /* CONFIG_IPQ806X */
        return false;

	return true;
}

static inline bool is_memory_region_available(uintptr_t load_addr, size_t size)
{
	uintptr_t end_addr;

	if (!is_load_addr_valid(load_addr))
		return false;

	end_addr = load_addr + size;

	/*
	 * The file to be loaded should not overwrite the
	 * code/stack area.
	 */
#ifdef CONFIG_IPQ806X
    if (end_addr >= IPQ_TFTP_MAX_ADDR)
#else
    if ((end_addr >= CONFIG_SYS_SDRAM_END) ||
        ((end_addr >= CONFIG_IPQ_FDT_HIGH) && (end_addr < CONFIG_TZ_END_ADDR)) ||
		((load_addr < CONFIG_IPQ_FDT_HIGH) && (end_addr >= CONFIG_TZ_END_ADDR)))
#endif /* CONFIG_IPQ806X */
        return false;

	return true;
}

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

void do_network_check(void);
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
