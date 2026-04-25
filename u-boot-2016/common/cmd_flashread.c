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
#include <part.h>
#include <linux/mtd/mtd.h>
#include <nand.h>
#include <mmc.h>
#include <sdhci.h>

#ifndef CONFIG_SDHCI_SUPPORT
extern qca_mmc mmc_host;
#else
extern struct sdhci_host mmc_host;
#endif

static int read_partition(const char *part_name, const ulong load_addr)
{
	qca_smem_flash_info_t *sfi = &qca_smem_flash_info;
	block_dev_desc_t *mmc_dev;
	disk_partition_t disk_info = {0};
	uint32_t offset_in_blocks = 0, size_in_blocks = 0;
	ulong offset_in_bytes = 0, size_in_bytes = 0;
    char buf[128];
	int ret;

	switch (sfi->flash_type) {
	case SMEM_BOOT_NAND_FLASH:
	case SMEM_BOOT_NOR_FLASH:
	case SMEM_BOOT_NORPLUSEMMC:
	case SMEM_BOOT_NORPLUSNAND:
	case SMEM_BOOT_ONENAND_FLASH:
	case SMEM_BOOT_QSPI_NAND_FLASH:
	case SMEM_BOOT_SPI_FLASH:
		ret = smem_getpart((char *)part_name, &offset_in_blocks, &size_in_blocks);
		if (!ret) {
            offset_in_bytes = (ulong)(sfi->flash_block_size * offset_in_blocks);
            size_in_bytes = (ulong)(sfi->flash_block_size * size_in_blocks);

            if (sfi->flash_type == SMEM_BOOT_NAND_FLASH ||
                sfi->flash_type == SMEM_BOOT_ONENAND_FLASH ||
                sfi->flash_type == SMEM_BOOT_QSPI_NAND_FLASH) {
                sprintf(buf, "nand read 0x%lx 0x%lx 0x%lx",
                    load_addr, offset_in_bytes, size_in_bytes);
            } else {
                sprintf(buf, "sf probe && sf read 0x%lx 0x%lx 0x%lx",
                    load_addr, offset_in_bytes, size_in_bytes);
            }

            break;
        }
	case SMEM_BOOT_MMC_FLASH:
	case SMEM_BOOT_NO_FLASH:
	case SMEM_BOOT_SDC_FLASH:
	default:
		mmc_dev = mmc_get_dev(mmc_host.dev_num);
		if (mmc_dev == NULL)
			goto part_not_found;

		ret = get_partition_info_efi_by_name(mmc_dev, (char *)part_name, &disk_info);
		if (ret)
			goto part_not_found;

		size_in_bytes = (ulong)(disk_info.size * disk_info.blksz);

        sprintf(buf, "mmc read 0x%lx 0x%lx 0x%lx",
            load_addr, (ulong)disk_info.start, (ulong)disk_info.size);
	}

    setenv_hex("fileaddr", load_addr);
    setenv_hex("filesize", size_in_bytes);
    setenv_hex("filesize_128k", (size_in_bytes / 131072 + (size_in_bytes % 131072 != 0)) * 131072);

    ret = run_command(buf, 0);
	if (ret) {
		printf("Failed to read partition %s\n", part_name);
		return ret;
	}

    return 0;

part_not_found:
    printf("Partition %s not found\n", part_name);
    return -1;
}

static int do_flash_read(cmd_tbl_t *cmdtp, int flag, int argc, char * const argv[])
{
    char *loadaddr;
    ulong load_addr;

    switch (argc) {
    case 2:
        loadaddr = getenv("loadaddr");
        if (loadaddr == NULL)
            return CMD_RET_USAGE;
        load_addr = simple_strtoul(loadaddr, NULL, 16);
        break;
    case 3:
        load_addr = simple_strtoul(argv[2], NULL, 16);
        break;
    default:
        return CMD_RET_USAGE;
        break;
	}

    return read_partition(argv[1], load_addr);
}

U_BOOT_CMD(
	flashread, 3, 0, do_flash_read,
	"flashread part_name\n"
    "\tflashread part_name load_addr",
	"read partition from flash memory device\n"
);
