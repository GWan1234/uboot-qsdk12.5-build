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
#include <asm/arch-qca-common/smem.h>
#include <ipq_api.h>

static int do_bootflash(cmd_tbl_t *cmdtp, int flag, int argc, char * const argv[])
{
    qca_smem_flash_info_t *sfi = &qca_smem_flash_info;
    detected_flash_device_t *dfd = &detected_flash_device;
    const char *flash_type_str;

    if (!is_9008_mode()) {
        puts("use in 9008 mode only\n");
        return CMD_RET_FAILURE;
    }

	if (argc != 3)
		return CMD_RET_USAGE;

	if (strncmp(argv[1], "set", 3))
        return CMD_RET_USAGE;

    flash_type_str = argv[2];

    if (!strncmp(flash_type_str, "nor", 3)) {
        if (!dfd->spi)
            goto flash_not_found;
        sfi->flash_type = SMEM_BOOT_SPI_FLASH;
    } else if (!strncmp(flash_type_str, "nand", 4)) {
        if (!dfd->nand)
            goto flash_not_found;
#ifdef CONFIG_QPIC_SERIAL
        sfi->flash_type = SMEM_BOOT_QSPI_NAND_FLASH;
#else
        sfi->flash_type = SMEM_BOOT_NAND_FLASH;
#endif
    } else if (!strncmp(flash_type_str, "mmc", 3)) {
        if (!dfd->mmc)
            goto flash_not_found;
        sfi->flash_type = SMEM_BOOT_MMC_FLASH;
    } else {
        return CMD_RET_USAGE;
    }

    printf("set smem boot flash type to %s (0x%x)\n", flash_type_str, sfi->flash_type);
    return CMD_RET_SUCCESS;

flash_not_found:
    printf("%s: flash not found\n", flash_type_str);
	return CMD_RET_FAILURE;
}

U_BOOT_CMD(
	bootflash, 3, 0, do_bootflash,
	"bootflash set <nor/nand/mmc>",
    "set smem boot flash type in 9008 mode"
);
