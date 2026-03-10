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
#include <cli.h>
#include <image.h>
#include <asm/gpio.h>
#include <fdtdec.h>
#include <part.h>
#include <mmc.h>
#include <sdhci.h>
#include <cmd_untar.h>
#include <asm/arch-qca-common/smem.h>
#include <linux/mtd/mtd.h>
#include <nand.h>
#include <ubi_uboot.h>
#include <failsafe/failsafe.h>
#include <failsafe/fw.h>
#include <ipq_api.h>
#include <u-boot/md5.h>
#include <net/httpd.h>

#ifndef CONFIG_SDHCI_SUPPORT
extern qca_mmc mmc_host;
#else
extern struct sdhci_host mmc_host;
#endif

DECLARE_GLOBAL_DATA_PTR;

static char info[666];
static char resp[888];
static char runcmd[666];
static int fw_type;
static uint32_t flash_type;
static qca_smem_flash_info_t *sfi = &qca_smem_flash_info;

/* Implemented in: u-boot-2016/board/qca/arm/common/cmd_bootqca.c */
extern int config_select(unsigned int addr, char *rcmd, int rcmd_size);

void *httpd_get_upload_buffer_ptr(size_t size)
{
	if (gd->ram_size >= 512 * 1024 * 1024)
		return (void *)(CONFIG_SYS_SDRAM_BASE + (256 << 20));
	else
		return (void *)(CONFIG_SYS_SDRAM_BASE + (64 << 20));
}

int boot_from_mem(const ulong data_addr)
{
    int ret;
    char bootm_arg[66];

	printf("\n"
        "*****************************\n"
        "*     INITRAMFS BOOTING     *\n"
        "* DO NOT POWER OFF DEVICE ! *\n"
        "*****************************\n\n"
    );

    ret = config_select((unsigned int)data_addr, bootm_arg, sizeof(bootm_arg));

    if (!ret)
        sprintf(runcmd, "bootm %s", bootm_arg);
    else
        sprintf(runcmd, "bootm 0x%lx", data_addr);

	printf("Executing: %s\n\n", runcmd);

	ret = run_command(runcmd, 0);

	return ret;
}

static uint32_t check_flash_type(void)
{
	switch (sfi->flash_type) {
	case SMEM_BOOT_SPI_FLASH:
		if (sfi->flash_secondary_type == SMEM_BOOT_MMC_FLASH)
			return SMEM_BOOT_NORPLUSEMMC;
		else
			return SMEM_BOOT_SPI_FLASH;
	case SMEM_BOOT_NO_FLASH:
		/*
		 * Flashless boot, typically in 9008 emergency download mode.
		 * Return the default flash type according to specific board configuration.
		 */
#if defined(MACHINE_FLASH_TYPE_EMMC)
		return SMEM_BOOT_MMC_FLASH;
#elif defined(MACHINE_FLASH_TYPE_NORPLUSEMMC)
		return SMEM_BOOT_NORPLUSEMMC;
#elif defined(MACHINE_FLASH_TYPE_NAND)
		return SMEM_BOOT_NAND_FLASH;
#endif
	default:
		return sfi->flash_type;
	}
}

static char *flash_type_to_string(uint32_t flash_type)
{
	switch (sfi->flash_type) {
	case SMEM_BOOT_MMC_FLASH: return "EMMC";
	case SMEM_BOOT_NAND_FLASH: return "NAND";
	case SMEM_BOOT_NO_FLASH: return "NO";
	case SMEM_BOOT_NOR_FLASH: return "NOR";
	case SMEM_BOOT_NORPLUSEMMC: return "NOR PLUS EMMC";
	case SMEM_BOOT_NORPLUSNAND: return "NOR PLUS NAND";
	case SMEM_BOOT_ONENAND_FLASH: return "ONENAND";
	case SMEM_BOOT_QSPI_NAND_FLASH: return "QSPI NAND";
	case SMEM_BOOT_SDC_FLASH: return "SDC";
	case SMEM_BOOT_SPI_FLASH: return "SPI";
	default: return "UNKNOWN";
	}
}

/**
 * check_part_exists - 检查指定分区是否存在
 * @part_name: 分区名
 * @flag: 是否返回和打印错误信息的标志
 *
 * 若找到指定分区则返回 RET_SUCCESS，否则返回 RET_PART_NOT_FOUND。
 *
 * NOTE: 目前不支持查找 NAND FLASH 中的 UBI 卷。
 */
static int check_part_exists(char *part_name, int flag)
{
	int ret;
	block_dev_desc_t *blk_dev;
	disk_partition_t disk_info = {0};
    uint32_t size_block, start_block;
	static qca_smem_flash_info_t *sfi = &qca_smem_flash_info;

	switch (sfi->flash_type) {
	case SMEM_BOOT_NAND_FLASH:
	case SMEM_BOOT_NOR_FLASH:
	case SMEM_BOOT_NORPLUSEMMC:
	case SMEM_BOOT_NORPLUSNAND:
	case SMEM_BOOT_ONENAND_FLASH:
	case SMEM_BOOT_QSPI_NAND_FLASH:
	case SMEM_BOOT_SPI_FLASH:
		ret = smem_getpart(part_name, &start_block, &size_block);
		if (!ret)
			/* 在 SMEM (Shared Memory) 中找到指定分区 */
			return RET_SUCCESS;
	case SMEM_BOOT_MMC_FLASH:
	case SMEM_BOOT_NO_FLASH:
	case SMEM_BOOT_SDC_FLASH:
	default:
		blk_dev = mmc_get_dev(mmc_host.dev_num);
		if (blk_dev == NULL)
			/* 找不到 eMMC */
			break;

		ret = get_partition_info_efi_by_name(blk_dev, part_name, &disk_info);
		if (!ret)
			/* 在 eMMC 中找到指定分区 */
			return RET_SUCCESS;
	}

	/* 找不到指定分区 */
	if (flag) {
		snprintf(info, sizeof(info),
			"{\"type\":\"part_not_found\","
			"\"partname\":\"%s\"}", part_name);

		printf("Error: partition %s not found\n", part_name);
	}

	return RET_PART_NOT_FOUND;
}

/**
 * check_file_size_is_valid - 检查文件大小是否合法
 * @file_name: 文件名
 * @part_name: 分区名（该文件将要被刷写到的分区）
 * @file_size_in_bytes: 文件大小字节数
 *
 * 如果文件大小超过相应分区大小，返回 RET_FILE_TOO_BIG；
 * 如果未找到相应分区，返回 RET_PART_NOT_FOUND；
 * 否则，返回 RET_SUCCESS。
 */
static int check_file_size_is_valid(char *file_name, char *part_name,
							const ulong file_size_in_bytes)
{
	int ret;
    block_dev_desc_t *blk_dev;
    disk_partition_t disk_info = {0};
    ulong part_size_in_blocks = 0;
	ulong part_size_in_bytes = 0;
    ulong file_size_in_blocks = 0;
	uint32_t size_block, start_block;
	qca_smem_flash_info_t *sfi = &qca_smem_flash_info;

	switch (sfi->flash_type) {
	case SMEM_BOOT_NAND_FLASH:
	case SMEM_BOOT_NOR_FLASH:
	case SMEM_BOOT_NORPLUSEMMC:
	case SMEM_BOOT_NORPLUSNAND:
	case SMEM_BOOT_ONENAND_FLASH:
	case SMEM_BOOT_QSPI_NAND_FLASH:
	case SMEM_BOOT_SPI_FLASH:
		ret = smem_getpart(part_name, &start_block, &size_block);
		if (!ret) {
			part_size_in_bytes = (ulong)(sfi->flash_block_size * size_block);
			if (file_size_in_bytes > part_size_in_bytes)
				goto file_too_big;
			break;
		}
	case SMEM_BOOT_MMC_FLASH:
	case SMEM_BOOT_NO_FLASH:
	case SMEM_BOOT_SDC_FLASH:
	default:
		blk_dev = mmc_get_dev(mmc_host.dev_num);
		if (blk_dev == NULL)
			goto part_not_found;

		ret = get_partition_info_efi_by_name(blk_dev, part_name, &disk_info);
		if (ret)
			goto part_not_found;

		part_size_in_blocks = (ulong)disk_info.size;
		part_size_in_bytes = part_size_in_blocks * disk_info.blksz;

		if (disk_info.blksz)
			file_size_in_blocks = file_size_in_bytes / disk_info.blksz
								 + (file_size_in_bytes % disk_info.blksz != 0);

		if (file_size_in_blocks > part_size_in_blocks)
			goto file_too_big;
	}

	return RET_SUCCESS;

file_too_big:
	snprintf(info, sizeof(info),
		"{\"type\":\"file_too_big\","
		"\"filename\":\"%s\",\"filesize\":\"%lu\","
		"\"partname\":\"%s\",\"partsize\":\"%lu\"}",
		file_name, file_size_in_bytes,
		part_name, part_size_in_bytes);
	printf("Error: %s size (%lu bytes) exceeds partition %s size (%lu bytes)\n",
		file_name, file_size_in_bytes, part_name, part_size_in_bytes);
	return RET_FILE_TOO_BIG;

part_not_found:
	snprintf(info, sizeof(info),
		"{\"type\":\"part_not_found\","
		"\"partname\":\"%s\"}", part_name);
	printf("Error: partition %s not found\n", part_name);
	return RET_PART_NOT_FOUND;
}

static inline void handle_wrong_fw_type(char *expected_file_type_str, int fw_type)
{
	char *actual_file_type_str = fw_type_to_string(fw_type);
	snprintf(info, sizeof(info),
		"{\"type\":\"wrong_file_type\","
		"\"expected\":\"%s\",\"actual\":\"%s\"}",
		expected_file_type_str, actual_file_type_str);
	printf("Error: wrong file type (expected: %s, actual: %s)\n",
		expected_file_type_str, actual_file_type_str);
}

static inline void handle_wrong_flash_type(char *file_type, uint32_t flash_type)
{
	char *flash_type_str = flash_type_to_string(flash_type);
	snprintf(info, sizeof(info),
		"{\"type\":\"wrong_flash_type\","
		"\"filetype\":\"%s\",\"flashtype\":\"%s\"}",
		file_type, flash_type_str);
	printf("Error: updating %s is NOT supported for %s FLASH yet!\n",
		file_type, flash_type_str);
}

static inline void handle_command_failure(char *runcmd)
{
	snprintf(info, sizeof(info),
		"{\"type\":\"command_failure\","
		"\"runcmd\":\"%s\"}", runcmd);
}

int failsafe_validate_image(const int upgrade_type, const void *data_addr,
			const ulong data_size_in_bytes, struct httpd_response *response)
{
	static char hexchars[] = "0123456789abcdef";
	static char md5_str[33] = "";
	int ret = RET_SUCCESS;
	int fw_type = check_fw_type(data_addr);

	memset(md5_str, 0, sizeof(md5_str));
	memset(info, 0, sizeof(info));
	memset(resp, 0, sizeof(resp));

	httpd_debug("[DEBUG] failsafe_validate_image(): "
		"fw_type = %d (%s), data_addr = 0x%p, data_size_in_bytes = %lu (0x%lx)\n",
		fw_type, fw_type_to_string(fw_type), data_addr, data_size_in_bytes, data_size_in_bytes);

	switch (upgrade_type) {
	case WEBFAILSAFE_UPGRADE_TYPE_FIRMWARE:
		switch (fw_type) {
#if defined(MACHINE_FLASH_TYPE_EMMC) || \
	defined(MACHINE_FLASH_TYPE_NORPLUSEMMC)
		case FW_TYPE_FACTORY_KERNEL6M:
		case FW_TYPE_FACTORY_KERNEL12M: {
			ulong kernel_size_in_bytes = 6 * 1024 * 1024;
			if (fw_type == FW_TYPE_FACTORY_KERNEL12M)
				kernel_size_in_bytes = 12 * 1024 * 1024;
			ret = check_file_size_is_valid("firmware kernel", "0:HLOS",
								kernel_size_in_bytes);
			if (ret)
				break;
			ret = check_file_size_is_valid("firmware rootfs", "rootfs",
								data_size_in_bytes - kernel_size_in_bytes);
			break;
		}
		case FW_TYPE_SYSUPGRADE: {
			const void *kernel_addr, *rootfs_addr;
			size_t kernel_size, rootfs_size;
			if (parse_tar_image(data_addr, (size_t)data_size_in_bytes,
								&kernel_addr, &kernel_size,
								&rootfs_addr, &rootfs_size)
			) {
				strncpy(info,
					"{\"type\":\"wrong_file_type\","
					"\"expected\":\"sysupgrade tar image\","
					"\"actual\":\"not a valid sysupgrade tar image\"}",
					sizeof(info));
				printf("Error: not a valid sysupgrade tar image\n");
				ret = RET_WRONG_FW_TYPE;
				break;
			}
			ret = check_file_size_is_valid("firmware kernel", "0:HLOS", (ulong)kernel_size);
			if (ret)
				break;
			ret = check_file_size_is_valid("firmware rootfs", "rootfs", (ulong)rootfs_size);
			break;
		}
		case FW_TYPE_ASUSWRT_EMMC:
		case FW_TYPE_QSDK:
			ret = check_part_exists("0:HLOS", 1);
			if (ret)
				break;
			ret = check_part_exists("rootfs", 1);
			if (ret)
				break;
			if (fw_type == FW_TYPE_QSDK) {
				ret = check_part_exists("0:WIFIFW", 1);
				if (ret)
					break;
			}
			break;
#endif
#if defined(MACHINE_FLASH_TYPE_NAND)
		case FW_TYPE_UBI:
			ret = check_file_size_is_valid("firmware", "rootfs", data_size_in_bytes);
			break;
#endif
		default:
			handle_wrong_fw_type("FIRMWARE", fw_type);
			ret = RET_WRONG_FW_TYPE;
		}
		break;
	case WEBFAILSAFE_UPGRADE_TYPE_UBOOT:
		if (fw_type != FW_TYPE_ELF) {
			handle_wrong_fw_type("U-BOOT ELF", fw_type);
			ret = RET_WRONG_FW_TYPE;
			break;
		}
		ret = check_file_size_is_valid("U-BOOT", "0:APPSBL", data_size_in_bytes);
		break;
	case WEBFAILSAFE_UPGRADE_TYPE_ART:
		/*
		 * ART 没有固定的魔数，所以无法识别一个文件是否为 ART。
		 * 这里使用排除法，排除一些已知的、非 ART 的文件类型。
		 */
		switch (fw_type) {
		case FW_TYPE_ASUSWRT_EMMC:
		case FW_TYPE_CDT:
		case FW_TYPE_ELF:
		case FW_TYPE_EMMC:
		case FW_TYPE_FACTORY_KERNEL6M:
		case FW_TYPE_FACTORY_KERNEL12M:
		case FW_TYPE_LEGACY_IMAGE:
		case FW_TYPE_FIT:
		case FW_TYPE_QSDK:
		case FW_TYPE_MIBIB_NAND:
		case FW_TYPE_MIBIB_NOR:
		case FW_TYPE_NAND:
		case FW_TYPE_NOR:
		case FW_TYPE_SYSUPGRADE:
		case FW_TYPE_UBI:
			handle_wrong_fw_type("ART", fw_type);
			ret = RET_WRONG_FW_TYPE;
			break;
		default:
			ret = check_file_size_is_valid("ART", "0:ART", data_size_in_bytes);
		}
		break;
	case WEBFAILSAFE_UPGRADE_TYPE_CDT:
		if (fw_type != FW_TYPE_CDT) {
			handle_wrong_fw_type("CDT", fw_type);
			ret = RET_WRONG_FW_TYPE;
			break;
		}
		ret = check_file_size_is_valid("CDT", "0:CDT", data_size_in_bytes);
		break;
	case WEBFAILSAFE_UPGRADE_TYPE_GPT:
		if (fw_type != FW_TYPE_EMMC) {
			handle_wrong_fw_type("GPT", fw_type);
			ret = RET_WRONG_FW_TYPE;
			break;
		}
		break;
	case WEBFAILSAFE_UPGRADE_TYPE_MIBIB:
		if (fw_type != FW_TYPE_MIBIB_NAND && fw_type != FW_TYPE_MIBIB_NOR) {
			handle_wrong_fw_type("MIBIB", fw_type);
			ret = RET_WRONG_FW_TYPE;
			break;
		}
		ret = check_file_size_is_valid("MIBIB", "0:MIBIB", data_size_in_bytes);
		break;
	case WEBFAILSAFE_UPGRADE_TYPE_SIMG:
#if defined(MACHINE_FLASH_TYPE_EMMC)
		if (fw_type != FW_TYPE_EMMC) {
			handle_wrong_fw_type("EMMC IMG", fw_type);
			ret = RET_WRONG_FW_TYPE;
			break;
		}
#endif
#if defined(MACHINE_FLASH_TYPE_NAND)
		if (fw_type != FW_TYPE_NAND) {
			handle_wrong_fw_type("NAND IMG", fw_type);
			ret = RET_WRONG_FW_TYPE;
			break;
		}
#endif
#if defined(MACHINE_FLASH_TYPE_NORPLUSEMMC)
		if (fw_type != FW_TYPE_EMMC && fw_type != FW_TYPE_NOR) {
			handle_wrong_fw_type("EMMC IMG or NOR IMG", fw_type);
			ret = RET_WRONG_FW_TYPE;
			break;
		}
#endif
		break;
	case WEBFAILSAFE_UPGRADE_TYPE_INITRAMFS:
		if (fw_type != FW_TYPE_FIT) {
			handle_wrong_fw_type("FIT INITRAMFS UIMAGE", fw_type);
			ret = RET_WRONG_FW_TYPE;
			break;
		}
		break;
	default:
		strncpy(info, "{\"type\":\"wrong_upgrade_type\"}", sizeof(info));
		printf("Error: not supported webfailsafe upgrade type\n");
		ret = RET_WRONG_UPGRADE_TYPE;
	}

	if (!ret) {
		u8 md5_sum[16];

		md5((u8 *)data_addr, data_size_in_bytes, md5_sum);

		for (int i = 0; i < 16; i++) {
			u8 hex = (md5_sum[i] >> 4) & 0xf;
			md5_str[i * 2] = hexchars[hex];
			hex = md5_sum[i] & 0xf;
			md5_str[i * 2 + 1] = hexchars[hex];
		}

		snprintf(info, sizeof(info),
			"{\"type\":\"%s\",\"size\":\"%lu\",\"md5\":\"%s\"}",
			fw_type_to_string(fw_type), data_size_in_bytes, md5_str);
	}

	snprintf(resp, sizeof(resp),
		"{\"status\":\"%s\",\"info\":%s}",
		ret ? "fail" : "success", info);
	response->data = resp;
	response->size = strlen(response->data);

	return ret;
}

static int failsafe_write_firmware(const ulong data_addr, const ulong data_size)
{
	int ret;

	printf("\n"
		"****************************\n"
		"*    FIRMWARE UPGRADING    *\n"
		"* DO NOT POWER OFF DEVICE! *\n"
		"****************************\n\n"
	);

	switch (flash_type) {
#if defined(MACHINE_FLASH_TYPE_EMMC) || \
	defined(MACHINE_FLASH_TYPE_NORPLUSEMMC)
	case SMEM_BOOT_MMC_FLASH:
	case SMEM_BOOT_NORPLUSEMMC:
		if (fw_type == FW_TYPE_FACTORY_KERNEL6M ||
			fw_type == FW_TYPE_FACTORY_KERNEL12M
		) {
			ulong kernel_size_in_bytes = 6 * 1024 * 1024;
			if (fw_type == FW_TYPE_FACTORY_KERNEL12M)
				kernel_size_in_bytes = 12 * 1024 * 1024;
			sprintf(runcmd,
				"flash 0:HLOS 0x%lx 0x%lx && "
				"flash rootfs 0x%lx 0x%lx && "
				"bootconfig set primary",
				data_addr, kernel_size_in_bytes,
				data_addr + kernel_size_in_bytes, data_size - kernel_size_in_bytes
			);
		} else if (fw_type == FW_TYPE_QSDK) {
			sprintf(runcmd,
				"xtract_n_flash 0x%lx hlos-0cc33b23252699d495d79a843032498bfa593aba 0:HLOS && "
				"xtract_n_flash 0x%lx rootfs-f3c50b484767661151cfb641e2622703e45020fe rootfs && "
				"xtract_n_flash 0x%lx wififw-45b62ade000c18bfeeb23ae30e5a6811eac05e2f 0:WIFIFW && "
				"flasherase rootfs_data && bootconfig set primary",
				data_addr,
				data_addr,
				data_addr
			);
		} else if (fw_type == FW_TYPE_SYSUPGRADE ||
			       fw_type == FW_TYPE_ASUSWRT_EMMC) {
			sprintf(runcmd,
				"untar 0x%lx 0x%lx && "
				"flash 0:HLOS $kernel_addr $kernel_size && "
				"flash rootfs $rootfs_addr $rootfs_size && "
				"bootconfig set primary",
				data_addr, data_size
			);
		} else {
			handle_wrong_fw_type("FIRMWARE", fw_type);
			return RET_WRONG_FW_TYPE;
		}
		break;
#endif
#if defined(MACHINE_FLASH_TYPE_NAND)
	case SMEM_BOOT_NAND_FLASH:
		if (fw_type == FW_TYPE_UBI) {
			sprintf(runcmd,
				"flash rootfs 0x%lx 0x%lx && "
				"bootconfig set primary",
				data_addr, data_size
			);
		} else {
			handle_wrong_fw_type("UBI FIRMWARE", fw_type);
			return RET_WRONG_FW_TYPE;
		}
		break;
#endif
	default:
		handle_wrong_flash_type("FIRMWARE", flash_type);
		return RET_WRONG_FLASH_TYPE;
	}

	printf("Executing: %s\n\n", runcmd);

	ret = run_command(runcmd, 0);

	if (!ret)
		return RET_SUCCESS;

	handle_command_failure(runcmd);
	return RET_FAILURE;
}

static int failsafe_write_uboot(const ulong data_addr, const ulong data_size)
{
	int ret;
	char *p = runcmd;
	size_t runcmd_size = sizeof(runcmd);

    if (fw_type != FW_TYPE_ELF) {
		handle_wrong_fw_type("U-BOOT ELF", fw_type);
        return RET_WRONG_FW_TYPE;
	}

	printf("\n"
        "****************************\n"
        "*     U-BOOT UPGRADING     *\n"
        "* DO NOT POWER OFF DEVICE! *\n"
        "****************************\n\n"
    );

	switch (flash_type) {
	case SMEM_BOOT_MMC_FLASH:
	case SMEM_BOOT_NAND_FLASH:
	case SMEM_BOOT_NORPLUSEMMC:
	case SMEM_BOOT_SPI_FLASH:
		if (p == runcmd)
			p += snprintf(p, runcmd + runcmd_size - p,
					"flash 0:APPSBL 0x%lx 0x%lx", data_addr, data_size);

		if (p >= runcmd + runcmd_size)
			break;

		ret = check_part_exists("0:APPSBL_1", 0);
		if (!ret)
			p += snprintf(p, runcmd + runcmd_size - p,
					" && flash 0:APPSBL_1 0x%lx 0x%lx", data_addr, data_size);
		break;
	default:
		handle_wrong_flash_type("U-BOOT", flash_type);
		return RET_WRONG_FLASH_TYPE;
	}

	printf("Executing: %s\n\n", runcmd);

	ret = run_command(runcmd, 0);

	if (!ret)
		return RET_SUCCESS;

	handle_command_failure(runcmd);
	return RET_FAILURE;
}

static int failsafe_write_art(const ulong data_addr, const ulong data_size)
{
	int ret;

	printf("\n"
        "****************************\n"
        "*      ART  UPGRADING      *\n"
        "* DO NOT POWER OFF DEVICE! *\n"
        "****************************\n\n"
    );

	switch (flash_type) {
	case SMEM_BOOT_MMC_FLASH:
	case SMEM_BOOT_NAND_FLASH:
	case SMEM_BOOT_NORPLUSEMMC:
	case SMEM_BOOT_SPI_FLASH:
		sprintf(runcmd,
			"flash 0:ART 0x%lx 0x%lx",
			data_addr, data_size
		);
		break;
	default:
		handle_wrong_flash_type("ART", flash_type);
		return RET_WRONG_FLASH_TYPE;
	}

	printf("Executing: %s\n\n", runcmd);

	ret = run_command(runcmd, 0);

	if (!ret)
		return RET_SUCCESS;

	handle_command_failure(runcmd);
	return RET_FAILURE;
}

static int failsafe_write_cdt(const ulong data_addr, const ulong data_size)
{
	int ret;
	char *p = runcmd;
	size_t runcmd_size = sizeof(runcmd);

    if (fw_type != FW_TYPE_CDT) {
		handle_wrong_fw_type("CDT", fw_type);
        return RET_WRONG_FW_TYPE;
	}

	printf("\n"
        "****************************\n"
        "*      CDT  UPGRADING      *\n"
        "* DO NOT POWER OFF DEVICE! *\n"
        "****************************\n\n"
    );

	switch (flash_type) {
	case SMEM_BOOT_MMC_FLASH:
	case SMEM_BOOT_NAND_FLASH:
	case SMEM_BOOT_NORPLUSEMMC:
	case SMEM_BOOT_SPI_FLASH:
		if (p == runcmd)
			p += snprintf(p, runcmd + runcmd_size - p,
					"flash 0:CDT 0x%lx 0x%lx", data_addr, data_size);

		if (p >= runcmd + runcmd_size)
			break;

		ret = check_part_exists("0:CDT_1", 0);
		if (!ret)
			p += snprintf(p, runcmd + runcmd_size - p,
					" && flash 0:CDT_1 0x%lx 0x%lx", data_addr, data_size);
		break;
	default:
		handle_wrong_flash_type("CDT", flash_type);
		return RET_WRONG_FLASH_TYPE;
	}

	printf("Executing: %s\n\n", runcmd);

	ret = run_command(runcmd, 0);

	if (!ret)
		return RET_SUCCESS;

	handle_command_failure(runcmd);
	return RET_FAILURE;
}

static int failsafe_write_gpt(const ulong data_addr, const ulong data_size)
{
	int ret;
	block_dev_desc_t *blk_dev;
    ulong data_size_in_blocks;

	if (fw_type != FW_TYPE_EMMC) {
		handle_wrong_fw_type("GPT", fw_type);
		return RET_WRONG_FW_TYPE;
	}

    blk_dev = mmc_get_dev(mmc_host.dev_num);
    if (blk_dev == NULL)
        data_size_in_blocks = 0;
    else
        data_size_in_blocks = data_size / blk_dev->blksz
                             + (data_size % blk_dev->blksz != 0);

	printf("\n"
		"****************************\n"
		"*       GPT UPGRADING      *\n"
		"* DO NOT POWER OFF DEVICE! *\n"
		"****************************\n\n"
	);

	switch (flash_type) {
	case SMEM_BOOT_MMC_FLASH:
	case SMEM_BOOT_NORPLUSEMMC:
		sprintf(runcmd,
			"mmc erase 0x0 0x%lx && "
			"mmc write 0x%lx 0x0 0x%lx",
			data_size_in_blocks,
			data_addr, data_size_in_blocks
		);
		break;
	default:
		handle_wrong_flash_type("GPT", flash_type);
		return RET_WRONG_FLASH_TYPE;
	}

	printf("Executing: %s\n\n", runcmd);

	ret = run_command(runcmd, 0);

	if (!ret)
		return RET_SUCCESS;

	handle_command_failure(runcmd);
	return RET_FAILURE;
}

static int failsafe_write_mibib(const ulong data_addr, const ulong data_size)
{
	int ret;

	if (fw_type != FW_TYPE_MIBIB_NAND &&
		fw_type != FW_TYPE_MIBIB_NOR
	) {
		handle_wrong_fw_type("MIBIB", fw_type);
		return RET_WRONG_FW_TYPE;
	}

	printf("\n"
		"****************************\n"
		"*      MIBIB UPGRADING     *\n"
		"* DO NOT POWER OFF DEVICE! *\n"
		"****************************\n\n"
	);

	switch (flash_type) {
	case SMEM_BOOT_NAND_FLASH:
	case SMEM_BOOT_NORPLUSEMMC:
	case SMEM_BOOT_SPI_FLASH:
		sprintf(runcmd,
			"flash 0:MIBIB 0x%lx 0x%lx",
			data_addr, data_size
		);
		break;
	default:
		handle_wrong_flash_type("MIBIB", flash_type);
		return RET_WRONG_FLASH_TYPE;
	}

	printf("Executing: %s\n\n", runcmd);

	ret = run_command(runcmd, 0);

	if (!ret)
		return RET_SUCCESS;

	handle_command_failure(runcmd);
	return RET_FAILURE;
}

static int failsafe_write_simg(const ulong data_addr, const ulong data_size)
{
	int ret;

#if defined(MACHINE_FLASH_TYPE_EMMC) || \
	defined(MACHINE_FLASH_TYPE_NORPLUSEMMC)
    block_dev_desc_t *blk_dev;
    ulong data_size_in_blocks;

    blk_dev = mmc_get_dev(mmc_host.dev_num);
    if (blk_dev == NULL)
        data_size_in_blocks = 0;
    else
        data_size_in_blocks = data_size / blk_dev->blksz
                             + (data_size % blk_dev->blksz != 0);
#endif

	printf("\n"
		"*****************************\n"
		"*       SIMG UPGRADING      *\n"
		"* DO NOT POWER OFF DEVICE ! *\n"
		"*****************************\n\n"
	);

	switch (flash_type) {
#if defined(MACHINE_FLASH_TYPE_EMMC)
	case SMEM_BOOT_MMC_FLASH:
		if (fw_type == FW_TYPE_EMMC) {
			sprintf(runcmd,
				"mmc erase 0x0 0x%lx && "
				"mmc write 0x%lx 0x0 0x%lx",
				data_size_in_blocks,
				data_addr, data_size_in_blocks
			);
		} else {
			handle_wrong_fw_type("EMMC IMG", fw_type);
			return RET_WRONG_FW_TYPE;
		}
		break;
#endif
#if defined(MACHINE_FLASH_TYPE_NAND)
	case SMEM_BOOT_NAND_FLASH:
		if (fw_type == FW_TYPE_NAND) {
			sprintf(runcmd,
				"nand erase 0x0 0x%lx && "
				"nand write 0x%lx 0x0 0x%lx",
				data_size,
				data_addr, data_size
			);
		} else {
			handle_wrong_fw_type("NAND IMG", fw_type);
			return RET_WRONG_FW_TYPE;
		}
		break;
#endif
#if defined(MACHINE_FLASH_TYPE_NORPLUSEMMC)
	case SMEM_BOOT_NORPLUSEMMC:
		if (fw_type == FW_TYPE_EMMC) {
			sprintf(runcmd,
				"mmc erase 0x0 0x%lx && "
				"mmc write 0x%lx 0x0 0x%lx",
				data_size_in_blocks,
				data_addr, data_size_in_blocks
			);
		} else if (fw_type == FW_TYPE_NOR) {
			sprintf(runcmd,
				"sf probe && sf update 0x%lx 0x0 0x%lx",
				data_addr, data_size
			);
		} else {
			handle_wrong_fw_type("EMMC IMG or NOR IMG", fw_type);
			return RET_WRONG_FW_TYPE;
		}
		break;
#endif
	default:
		handle_wrong_flash_type("Single Image", flash_type);
		return RET_WRONG_FLASH_TYPE;
	}

	printf("Executing: %s\n\n", runcmd);

	ret = run_command(runcmd, 0);

	if (!ret)
		return RET_SUCCESS;

	handle_command_failure(runcmd);
	return RET_FAILURE;
}

int failsafe_write_image(const int upgrade_type, const ulong data_addr,
			const ulong data_size, struct httpd_response *response)
{
    int ret;

	fw_type = check_fw_type((const void *)data_addr);
	flash_type = check_flash_type();

	memset(info, 0, sizeof(info));
	memset(resp, 0, sizeof(resp));
    memset(runcmd, 0, sizeof(runcmd));

	switch (upgrade_type) {
    case WEBFAILSAFE_UPGRADE_TYPE_FIRMWARE:
        ret = failsafe_write_firmware(data_addr, data_size);
        break;
    case WEBFAILSAFE_UPGRADE_TYPE_UBOOT:
        ret = failsafe_write_uboot(data_addr, data_size);
        break;
    case WEBFAILSAFE_UPGRADE_TYPE_ART:
        ret = failsafe_write_art(data_addr, data_size);
        break;
    case WEBFAILSAFE_UPGRADE_TYPE_CDT:
        ret = failsafe_write_cdt(data_addr, data_size);
        break;
    case WEBFAILSAFE_UPGRADE_TYPE_GPT:
        ret = failsafe_write_gpt(data_addr, data_size);
        break;
    case WEBFAILSAFE_UPGRADE_TYPE_MIBIB:
        ret = failsafe_write_mibib(data_addr, data_size);
        break;
    case WEBFAILSAFE_UPGRADE_TYPE_SIMG:
        ret = failsafe_write_simg(data_addr, data_size);
        break;
    default:
        ret = RET_WRONG_UPGRADE_TYPE;
	}

	if (ret) {
		snprintf(resp, sizeof(resp),
			"{\"status\":\"fail\",\"info\":%s}", info);
		response->data = resp;
	}

    return ret;
}
