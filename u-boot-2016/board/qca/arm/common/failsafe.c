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
#include <spi.h>
#include <spi_flash.h>
#include <mmc.h>
#include <sdhci.h>
#include <asm/arch-qca-common/smem.h>
#include <linux/mtd/mtd.h>
#include <nand.h>
#include <ubi_uboot.h>
#include <failsafe/failsafe.h>
#include <failsafe/fw.h>
#include <ipq_api.h>
#include <u-boot/md5.h>
#include <net/httpd.h>
#include <console.h>
#include <membuff.h>

#include "untar.h"

#ifndef CONFIG_SDHCI_SUPPORT
extern qca_mmc mmc_host;
#else
extern struct sdhci_host mmc_host;
#endif

DECLARE_GLOBAL_DATA_PTR;

#define FAILSAFE_CAPTURE_RECORD_OUT_SIZE 0x400

#define MAX_CMD_COUNT  10
#define MAX_CMD_LEN    256

static struct cmdlist {
	char list[MAX_CMD_COUNT][MAX_CMD_LEN];
	int count;
} runcmd;

static struct {
	char hlos_name[256];
	char rootfs_name[256];
	char wififw_name[256];
} jdc_fw;

static char gl_fw_ubi_name[66];

static char info[666];
static char resp[888];
static int fw_type;
static detected_flash_device_t *dfd = &detected_flash_device;

/* Implemented in: u-boot-2016/board/qca/arm/common/cmd_bootqca.c */
extern int config_select(unsigned int addr, char *rcmd, int rcmd_size);

void *httpd_get_upload_buffer_ptr(size_t size)
{
	ulong load_addr;

	if (gd->ram_size >= 512 * 1024 * 1024)
		load_addr = CONFIG_SYS_SDRAM_BASE + (256 << 20);
	else
		load_addr = IPQ_TFTP_MIN_ADDR;

	/*
	 * The file to be loaded should not overwrite the
	 * code/stack area.
	 */
#ifdef CONFIG_IPQ806X
    if ((load_addr + size) >= IPQ_TFTP_MAX_ADDR)
#else
    if (((load_addr + size) >= CONFIG_SYS_SDRAM_END) ||
        (((load_addr + size) >= CONFIG_IPQ_FDT_HIGH) &&
            ((load_addr + size) < CONFIG_TZ_END_ADDR)))
#endif /* CONFIG_IPQ806X */
    {
        puts("Error: file size too large\n");
        return NULL;
    }

	return (void *)load_addr;
}

int boot_from_mem(const ulong data_addr)
{
    int ret;
	char rcmd[99], bootm_arg[66];

	puts("\n"
        "********************************\n"
        " INITRAMFS BOOTING\n"
        " DO NOT POWER OFF DEVICE!\n"
        "********************************\n");

    ret = config_select((unsigned int)data_addr, bootm_arg, sizeof(bootm_arg));

    if (!ret)
		snprintf(rcmd, sizeof(rcmd), "bootm %s", bootm_arg);
	else
		snprintf(rcmd, sizeof(rcmd), "bootm 0x%lx", data_addr);

	printf("\n### Executing: %s\n", rcmd);

	return run_command(rcmd, 0);
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
static int check_part_exists(const char *part_name, int flag)
{
	if (smem_part_exists(part_name) || mmc_part_exists(part_name))
		return RET_SUCCESS;

	if (flag) {
		snprintf(info, sizeof(info),
			"{\"type\":\"part_not_found\",\"partname\":\"%s\"}", part_name);
		printf("Error: partition %s not found\n", part_name);
	}

	return RET_PART_NOT_FOUND;
}

/**
 * check_file_size_is_valid - 检查文件大小是否合法
 * @file_name: 文件名
 * @part_name: 分区名（该文件将要被刷写到的分区）
 * @file_size_bytes: 文件大小字节数
 *
 * 如果文件大小超过相应分区大小，返回 RET_FILE_TOO_BIG；
 * 如果未找到相应分区，返回 RET_PART_NOT_FOUND；
 * 否则，返回 RET_SUCCESS。
 */
static int check_file_size_is_valid(char *file_name, char *part_name,
							const ulong file_size_bytes)
{
	int ret;
    block_dev_desc_t *mmc_dev;
    disk_partition_t disk_info = {0};
    ulong part_size_blocks = 0;
	ulong part_size_bytes = 0;
    ulong file_size_blocks = 0;
	uint32_t offset_bytes, size_bytes;

	if (dfd->spi || dfd->nand) {
		ret = getpart_offset_size(part_name, &offset_bytes, &size_bytes);
		if (!ret) {
			part_size_bytes = (ulong)size_bytes;
			if (file_size_bytes > part_size_bytes)
				goto file_too_big;
			return RET_SUCCESS;
		}
	}

	if (!dfd->mmc)
		goto part_not_found;

	mmc_dev = mmc_get_dev(mmc_host.dev_num);
	if (!mmc_dev)
		goto part_not_found;

	ret = get_partition_info_efi_by_name(mmc_dev, part_name, &disk_info);
	if (ret)
		goto part_not_found;

	part_size_blocks = (ulong)disk_info.size;
	part_size_bytes = part_size_blocks * disk_info.blksz;

	if (disk_info.blksz)
		file_size_blocks = file_size_bytes / disk_info.blksz
								+ (file_size_bytes % disk_info.blksz != 0);

	if (file_size_blocks > part_size_blocks)
		goto file_too_big;

	return RET_SUCCESS;

file_too_big:
	snprintf(info, sizeof(info),
		"{\"type\":\"file_too_big\","
		"\"filename\":\"%s\",\"filesize\":\"%lu\","
		"\"partname\":\"%s\",\"partsize\":\"%lu\"}",
		file_name, file_size_bytes,
		part_name, part_size_bytes);
	printf("Error: %s size (%lu bytes) exceeds partition %s size (%lu bytes)\n",
		file_name, file_size_bytes, part_name, part_size_bytes);
	return RET_FILE_TOO_BIG;

part_not_found:
	snprintf(info, sizeof(info),
		"{\"type\":\"part_not_found\","
		"\"partname\":\"%s\"}", part_name);
	printf("Error: partition %s not found\n", part_name);
	return RET_PART_NOT_FOUND;
}

static void handle_wrong_fw_type(const char *expected_file_type_str, const int fw_type)
{
	char *actual_file_type_str = fw_type_to_string(fw_type);
	snprintf(info, sizeof(info),
		"{\"type\":\"wrong_file_type\","
		"\"expected\":\"%s\",\"actual\":\"%s\"}",
		expected_file_type_str, actual_file_type_str);
	printf("Error: wrong file type (expected: %s, actual: %s)\n",
		expected_file_type_str, actual_file_type_str);
}

static void handle_flash_not_found(const int fw_type, const char *flash_type_str)
{
	char *fw_type_str = fw_type_to_string(fw_type);
	snprintf(info, sizeof(info),
		"{\"type\":\"flash_not_found\","
		"\"filetype\":\"%s\",\"flashtype\":\"%s\"}",
		fw_type_str, flash_type_str);
	printf("Error: upload file is %s, but no %s FLASH found\n",
		fw_type_str, flash_type_str);
}

static void handle_invalid_qsdk_fw(const char *node_prefix)
{
	snprintf(info, sizeof(info),
		"{\"type\":\"fit_node_not_found\","
		"\"node_prefix\":\"%s\"}", node_prefix);
}

static int get_gl_fw_node_name(const void *data_addr)
{
	int ret;

	ret = fit_image_get_node_by_prefix(data_addr, FIT_IMAGES_PATH, "ubi",
                            gl_fw_ubi_name, sizeof(gl_fw_ubi_name));
    if (ret)
		handle_invalid_qsdk_fw("ubi");

	return ret ? RET_FAILURE : RET_SUCCESS;
}

static int get_jdc_fw_node_name(const void *data_addr)
{
	int ret;
	const void *fit = data_addr;

    ret = fit_image_get_node_by_prefix(fit, FIT_IMAGES_PATH, "hlos",
                            jdc_fw.hlos_name, sizeof(jdc_fw.hlos_name));
    if (ret) {
        handle_invalid_qsdk_fw("hlos");
		return RET_FAILURE;
    }

    ret = fit_image_get_node_by_prefix(fit, FIT_IMAGES_PATH, "rootfs",
                            jdc_fw.rootfs_name, sizeof(jdc_fw.rootfs_name));
    if (ret) {
        handle_invalid_qsdk_fw("rootfs");
		return RET_FAILURE;
    }

    ret = fit_image_get_node_by_prefix(fit, FIT_IMAGES_PATH, "wififw",
                            jdc_fw.wififw_name, sizeof(jdc_fw.wififw_name));
    if (ret) {
        handle_invalid_qsdk_fw("wififw");
		return RET_FAILURE;
    }

	return RET_SUCCESS;
}

static int failsafe_validate_firmware(const void *data_addr, const ulong data_size)
{
    int ret;

    switch (fw_type) {
    case FW_TYPE_FACTORY_KERNEL6M:
    case FW_TYPE_FACTORY_KERNEL12M:
		if (!dfd->mmc) {
			handle_flash_not_found(fw_type, "EMMC");
			return RET_FLASH_NOT_FOUND;
		}
        ulong factory_kernel_size = 6 * 1024 * 1024;
        if (fw_type == FW_TYPE_FACTORY_KERNEL12M)
            factory_kernel_size = 12 * 1024 * 1024;
        ret = check_file_size_is_valid("firmware kernel", "0:HLOS", factory_kernel_size);
        if (ret)
            break;
        ret = check_file_size_is_valid("firmware rootfs", "rootfs", data_size - factory_kernel_size);
        break;
    case FW_TYPE_SYSUPGRADE:
		if (!dfd->mmc) {
			handle_flash_not_found(fw_type, "EMMC");
			return RET_FLASH_NOT_FOUND;
		}
        size_t kernel_size, rootfs_size;
        if (parse_tar_image(data_addr, (size_t)data_size,
                            NULL, &kernel_size, NULL, &rootfs_size)) {
            strlcpy(info,
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
    case FW_TYPE_ASUSWRT_EMMC:
		if (!dfd->mmc) {
			handle_flash_not_found(fw_type, "EMMC");
			return RET_FLASH_NOT_FOUND;
		}
        ret = check_part_exists("0:HLOS", 1);
        if (ret)
            break;
        ret = check_part_exists("rootfs", 1);
        break;
	case FW_TYPE_GLINET_V3:
	case FW_TYPE_GLINET_V4:
		if (!dfd->nand) {
			handle_flash_not_found(fw_type, "NAND");
			return RET_FLASH_NOT_FOUND;
		}
		ret = check_part_exists("rootfs", 1);
        if (ret)
            break;
		ret = get_gl_fw_node_name(data_addr);
		break;
    case FW_TYPE_JDCLOUD:
		if (!dfd->mmc) {
			handle_flash_not_found(fw_type, "EMMC");
			return RET_FLASH_NOT_FOUND;
		}
        ret = check_part_exists("0:HLOS", 1);
        if (ret)
            break;
        ret = check_part_exists("rootfs", 1);
        if (ret)
            break;
        ret = check_part_exists("0:WIFIFW", 1);
        if (ret)
            break;
        ret = check_part_exists("rootfs_data", 1);
        if (ret)
            break;
        ret = get_jdc_fw_node_name(data_addr);
        break;
    case FW_TYPE_UBI:
        if (!dfd->nand) {
			handle_flash_not_found(fw_type, "NAND");
			return RET_FLASH_NOT_FOUND;
		}
        ret = check_file_size_is_valid("firmware", "rootfs", data_size);
        break;
    default:
        handle_wrong_fw_type("FIRMWARE", fw_type);
        ret = RET_WRONG_FW_TYPE;
    }

    return ret;
}

static int failsafe_validate_uboot(const void *data_addr, const ulong data_size)
{
    if (fw_type != FW_TYPE_ELF) {
        handle_wrong_fw_type("U-BOOT ELF", fw_type);
        return RET_WRONG_FW_TYPE;
    }

    return check_file_size_is_valid("U-BOOT", "0:APPSBL", data_size);
}

static int failsafe_validate_art(const void *data_addr, const ulong data_size)
{
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
	case FW_TYPE_GLINET_V3:
	case FW_TYPE_GLINET_V4:
    case FW_TYPE_JDCLOUD:
    case FW_TYPE_MIBIB_NAND:
    case FW_TYPE_MIBIB_NOR:
    case FW_TYPE_NAND:
    case FW_TYPE_NOR:
    case FW_TYPE_SYSUPGRADE:
    case FW_TYPE_UBI:
        handle_wrong_fw_type("ART", fw_type);
        return RET_WRONG_FW_TYPE;
    default:
        return check_file_size_is_valid("ART", "0:ART", data_size);
    }
}

static int failsafe_validate_cdt(const void *data_addr, const ulong data_size)
{
    if (fw_type != FW_TYPE_CDT) {
        handle_wrong_fw_type("CDT", fw_type);
        return RET_WRONG_FW_TYPE;
    }

    return check_file_size_is_valid("CDT", "0:CDT", data_size);
}

static int failsafe_validate_ptable(const void *data_addr, const ulong data_size)
{
	switch(fw_type) {
	case FW_TYPE_EMMC:
		if (!dfd->mmc) {
			handle_flash_not_found(fw_type, "EMMC");
			return RET_FLASH_NOT_FOUND;
		}
		return RET_SUCCESS;
    case FW_TYPE_MIBIB_NAND:
        if (!dfd->nand) {
			handle_flash_not_found(fw_type, "NAND");
			return RET_FLASH_NOT_FOUND;
		}
        return check_file_size_is_valid("MIBIB", "0:MIBIB", data_size);
    case FW_TYPE_MIBIB_NOR:
        if (!dfd->spi) {
            handle_flash_not_found(fw_type, "SPI-NOR");
			return RET_FLASH_NOT_FOUND;
        }
        return check_file_size_is_valid("MIBIB", "0:MIBIB", data_size);
    default:
        handle_wrong_fw_type("Partition Table (GPT or MIBIB)", fw_type);
        return RET_WRONG_FW_TYPE;
    }
}

static int failsafe_validate_simg(const void *data_addr, const ulong data_size)
{
	struct mmc *mmc;
	struct spi_flash *spi;
	nand_info_t *nand;
	unsigned long long flash_device_size;

    switch(fw_type) {
    case FW_TYPE_EMMC:
        if (!dfd->mmc) {
			handle_flash_not_found(fw_type, "EMMC");
			return RET_FLASH_NOT_FOUND;
		}
		mmc = find_mmc_device(mmc_host.dev_num);
		flash_device_size = mmc->capacity_user;
        break;
    case FW_TYPE_NAND:
        if (!dfd->nand) {
			handle_flash_not_found(fw_type, "NAND");
			return RET_FLASH_NOT_FOUND;
		}
		nand = &nand_info[CONFIG_NAND_FLASH_INFO_IDX];
		flash_device_size = nand->size;
        break;
    case FW_TYPE_NOR:
        if (!dfd->spi) {
			handle_flash_not_found(fw_type, "SPI-NOR");
			return RET_FLASH_NOT_FOUND;
		}
		spi = spi_flash_probe(CONFIG_SF_DEFAULT_BUS, CONFIG_SF_DEFAULT_CS,
					CONFIG_SF_DEFAULT_SPEED, CONFIG_SF_DEFAULT_MODE);
		flash_device_size = spi->size;
        break;
    default:
        handle_wrong_fw_type("Single Image", fw_type);
        return RET_WRONG_FW_TYPE;
    }

	if ((unsigned long long)data_size > flash_device_size) {
		snprintf(info, sizeof(info),
			"{\"type\":\"file_too_big\","
			"\"filename\":\"Single Image\",\"filesize\":\"%lu\","
			"\"partname\":\"Whole Chip\",\"partsize\":\"%llu\"}",
			data_size, flash_device_size);
		printf("Error: Single Image size (%lu bytes) exceeds Whole Chip size (%llu bytes)\n",
			data_size, flash_device_size);
		return RET_FILE_TOO_BIG;
	}

	return RET_SUCCESS;
}

static int failsafe_validate_initramfs(const void *data_addr, const ulong data_size)
{
    if (fw_type != FW_TYPE_FIT) {
        handle_wrong_fw_type("FIT INITRAMFS UIMAGE", fw_type);
        return RET_WRONG_FW_TYPE;
    }

    return RET_SUCCESS;
}

int failsafe_validate_image(const int upgrade_type, const char *filename,
	const void *data_addr, const ulong data_size, struct httpd_response *response)
{
	int ret;

	fw_type = check_fw_type(data_addr);

	memset(info, 0, sizeof(info));
	memset(resp, 0, sizeof(resp));

	httpd_debug("fw_type = %d (%s), data_addr = 0x%lx, data_size = %lu (0x%lx)\n",
		fw_type, fw_type_to_string(fw_type), (ulong)data_addr, data_size, data_size);

	switch (upgrade_type) {
	case WEBFAILSAFE_UPGRADE_TYPE_FIRMWARE:
		ret = failsafe_validate_firmware(data_addr, data_size);
		break;
	case WEBFAILSAFE_UPGRADE_TYPE_UBOOT:
		ret = failsafe_validate_uboot(data_addr, data_size);
		break;
	case WEBFAILSAFE_UPGRADE_TYPE_ART:
		ret = failsafe_validate_art(data_addr, data_size);
		break;
	case WEBFAILSAFE_UPGRADE_TYPE_CDT:
		ret = failsafe_validate_cdt(data_addr, data_size);
		break;
	case WEBFAILSAFE_UPGRADE_TYPE_PTABLE:
		ret = failsafe_validate_ptable(data_addr, data_size);
		break;
	case WEBFAILSAFE_UPGRADE_TYPE_SIMG:
		ret = failsafe_validate_simg(data_addr, data_size);
		break;
	case WEBFAILSAFE_UPGRADE_TYPE_INITRAMFS:
		ret = failsafe_validate_initramfs(data_addr, data_size);
		break;
	default:
		strlcpy(info, "{\"type\":\"wrong_upgrade_type\"}", sizeof(info));
		printf("Error: not supported webfailsafe upgrade type\n");
		ret = RET_WRONG_UPGRADE_TYPE;
	}

	if (!ret) {
		char *hexchars = "0123456789abcdef";
		char md5_str[33], esc_filename[512];
		u8 md5_sum[16];

		memset(md5_str, 0, sizeof(md5_str));
		md5((u8 *)data_addr, data_size, md5_sum);

		for (int i = 0; i < 16; i++) {
			u8 hex = (md5_sum[i] >> 4) & 0xf;
			md5_str[i * 2] = hexchars[hex];
			hex = md5_sum[i] & 0xf;
			md5_str[i * 2 + 1] = hexchars[hex];
		}

		json_escape(filename, esc_filename, sizeof(esc_filename));
		snprintf(info, sizeof(info),
			"{\"type\":\"%s\",\"size\":\"%lu\",\"md5\":\"%s\",\"name\":\"%s\"}",
			fw_type_to_string(fw_type), data_size, md5_str, esc_filename[0] ? esc_filename : "NONE");
	}

	snprintf(resp, sizeof(resp),
		"{\"status\":\"%s\",\"info\":%s}",
		ret ? "fail" : "success", info);
	response->data = resp;
	response->size = strlen(response->data);

	return ret;
}

static void handle_run_command_failed(const char *cmd, const char *output)
{
	char escaped_cmd[MAX_CMD_LEN * 2];
	char *escaped_output, *buf;
	size_t buf_size = 2 * strlen(output);

	printf("Failed to run: %s\n", cmd);

	json_escape(cmd, escaped_cmd, sizeof(escaped_cmd));

	buf = malloc(buf_size);
	if (buf) {
		json_escape(output, buf, buf_size);
		escaped_output = buf[0] ? buf : "none";
	} else {
		escaped_output = "[ERROR] malloc failed, cannot escape output.";
	}

	snprintf(info, sizeof(info),
		"{\"type\":\"run_cmd_failed\",\"cmd\":\"%s\",\"output\":\"%s\"}",
		escaped_cmd, escaped_output);

	if (buf)
		free(buf);
}

static int run_command_capture(const char *cmd)
{
	bool capture_on;
	int ret, avail, want, got;
	char output[FAILSAFE_CAPTURE_RECORD_OUT_SIZE];

	printf("\n### Executing: %s\n", cmd);

	ret = membuff_new((struct membuff *)&gd->failsafe_capture_out,
				FAILSAFE_CAPTURE_RECORD_OUT_SIZE);

	capture_on = ret ? false : true;

	if (capture_on)
		membuff_purge((struct membuff *)&gd->failsafe_capture_out);

	ret = run_command(cmd, 0);

	if (ret && capture_on) {
		avail = membuff_avail((struct membuff *)&gd->failsafe_capture_out);
		want = min(avail, (int)FAILSAFE_CAPTURE_RECORD_OUT_SIZE);
		got = membuff_get((struct membuff *)&gd->failsafe_capture_out, output, want);
		output[got] = '\0';
	}

	if (ret)
		handle_run_command_failed(cmd,
			capture_on ? output : "[ERROR] Failed to capture output.");

	if (capture_on)
		membuff_dispose((struct membuff *)&gd->failsafe_capture_out);

	return ret;
}

static int failsafe_run_command_list(struct cmdlist *runcmd)
{
    struct cmdlist *p = runcmd;

    if (p->count > MAX_CMD_COUNT) {
        printf("\nError: too many commands (current: %d, max: %d), "
			"please increase MAX_CMD_COUNT\n", p->count, MAX_CMD_COUNT);
        return RET_FAILURE;
    }

    for (int i = 0; i < p->count; i++)
        if (run_command_capture(p->list[i]))
            return RET_FAILURE;

    return RET_SUCCESS;
}

static void print_upgrade_hint(const char *upgrade_type_str)
{
	printf("\n"
		"********************************\n"
		" %s UPGRADING\n"
		" DO NOT POWER OFF DEVICE!\n"
		"********************************\n", upgrade_type_str);
}

static int failsafe_write_firmware(const ulong data_addr, const ulong data_size)
{
	print_upgrade_hint("FIRMWARE");

	switch (fw_type) {
	case FW_TYPE_FACTORY_KERNEL6M:
	case FW_TYPE_FACTORY_KERNEL12M:
		if (!dfd->mmc) {
			handle_flash_not_found(fw_type, "EMMC");
			return RET_FLASH_NOT_FOUND;
		}
		ulong kernel_size = 6 * 1024 * 1024;
		if (fw_type == FW_TYPE_FACTORY_KERNEL12M)
			kernel_size = 12 * 1024 * 1024;
		snprintf(runcmd.list[runcmd.count++], MAX_CMD_LEN,
			"flash 0:HLOS 0x%lx 0x%lx",
			data_addr, kernel_size);
		snprintf(runcmd.list[runcmd.count++], MAX_CMD_LEN,
			"flash rootfs 0x%lx 0x%lx",
			data_addr + kernel_size,
			data_size - kernel_size);
		strlcpy(runcmd.list[runcmd.count++],
			"bootconfig set all 0 && bootconfig sync", MAX_CMD_LEN);
		break;
	case FW_TYPE_GLINET_V3:
	case FW_TYPE_GLINET_V4:
		if (!dfd->nand) {
			handle_flash_not_found(fw_type, "NAND");
			return RET_FLASH_NOT_FOUND;
		}
		setenv("verbose", "1"); /* 执行 xtract_n_flash 时输出详细信息 */
		snprintf(runcmd.list[runcmd.count++], MAX_CMD_LEN,
			"xtract_n_flash 0x%lx %s rootfs",
			data_addr, gl_fw_ubi_name);
		strlcpy(runcmd.list[runcmd.count++],
			"bootconfig set all 0 && bootconfig sync", MAX_CMD_LEN);
		break;
	case FW_TYPE_JDCLOUD:
		if (!dfd->mmc) {
			handle_flash_not_found(fw_type, "EMMC");
			return RET_FLASH_NOT_FOUND;
		}
		setenv("verbose", "1"); /* 执行 xtract_n_flash 时输出详细信息 */
		snprintf(runcmd.list[runcmd.count++], MAX_CMD_LEN,
			"xtract_n_flash 0x%lx %s 0:HLOS",
			data_addr, jdc_fw.hlos_name);
		snprintf(runcmd.list[runcmd.count++], MAX_CMD_LEN,
			"xtract_n_flash 0x%lx %s rootfs",
			data_addr, jdc_fw.rootfs_name);
		snprintf(runcmd.list[runcmd.count++], MAX_CMD_LEN,
			"xtract_n_flash 0x%lx %s 0:WIFIFW",
			data_addr, jdc_fw.wififw_name);
		strlcpy(runcmd.list[runcmd.count++],
			"flasherase rootfs_data", MAX_CMD_LEN);
		strlcpy(runcmd.list[runcmd.count++],
			"bootconfig set all 0 && bootconfig sync", MAX_CMD_LEN);
		break;
	case FW_TYPE_SYSUPGRADE:
	case FW_TYPE_ASUSWRT_EMMC:
		if (!dfd->mmc) {
			handle_flash_not_found(fw_type, "EMMC");
			return RET_FLASH_NOT_FOUND;
		}
		snprintf(runcmd.list[runcmd.count++], MAX_CMD_LEN,
			"untar 0x%lx 0x%lx", data_addr, data_size);
		strlcpy(runcmd.list[runcmd.count++],
			"flash 0:HLOS $kernel_addr $kernel_size", MAX_CMD_LEN);
		strlcpy(runcmd.list[runcmd.count++],
			"flash rootfs $rootfs_addr $rootfs_size", MAX_CMD_LEN);
		strlcpy(runcmd.list[runcmd.count++],
			"bootconfig set all 0 && bootconfig sync", MAX_CMD_LEN);
		break;
	case FW_TYPE_UBI:
		if (!dfd->nand) {
			handle_flash_not_found(fw_type, "NAND");
			return RET_FLASH_NOT_FOUND;
		}
		snprintf(runcmd.list[runcmd.count++], MAX_CMD_LEN,
			"flash rootfs 0x%lx 0x%lx", data_addr, data_size);
		strlcpy(runcmd.list[runcmd.count++],
			"bootconfig set all 0 && bootconfig sync", MAX_CMD_LEN);
		break;
	default:
		handle_wrong_fw_type("FIRMWARE", fw_type);
		return RET_WRONG_FW_TYPE;
	}

	return failsafe_run_command_list(&runcmd);
}

static int failsafe_write_uboot(const ulong data_addr, const ulong data_size)
{
    print_upgrade_hint("U-BOOT");

    if (fw_type != FW_TYPE_ELF) {
		handle_wrong_fw_type("U-BOOT ELF", fw_type);
        return RET_WRONG_FW_TYPE;
	}

	snprintf(runcmd.list[runcmd.count++], MAX_CMD_LEN,
		"flash 0:APPSBL 0x%lx 0x%lx", data_addr, data_size);

	if (!check_part_exists("0:APPSBL_1", 0))
		snprintf(runcmd.list[runcmd.count++], MAX_CMD_LEN,
			"flash 0:APPSBL_1 0x%lx 0x%lx", data_addr, data_size);

	return failsafe_run_command_list(&runcmd);
}

static int failsafe_write_art(const ulong data_addr, const ulong data_size)
{
    print_upgrade_hint("ART");

	snprintf(runcmd.list[runcmd.count++], MAX_CMD_LEN,
		"flash 0:ART 0x%lx 0x%lx", data_addr, data_size);

	return failsafe_run_command_list(&runcmd);
}

static int failsafe_write_cdt(const ulong data_addr, const ulong data_size)
{
    print_upgrade_hint("CDT");

    if (fw_type != FW_TYPE_CDT) {
		handle_wrong_fw_type("CDT", fw_type);
        return RET_WRONG_FW_TYPE;
	}

	snprintf(runcmd.list[runcmd.count++], MAX_CMD_LEN,
		"flash 0:CDT 0x%lx 0x%lx", data_addr, data_size);

	if (!check_part_exists("0:CDT_1", 0))
		snprintf(runcmd.list[runcmd.count++], MAX_CMD_LEN,
			"flash 0:CDT_1 0x%lx 0x%lx", data_addr, data_size);

	return failsafe_run_command_list(&runcmd);
}

static void handle_gpt_write_cmd(const ulong data_addr, const ulong data_size)
{
	block_dev_desc_t *mmc_dev;
    ulong data_size_in_blocks;

    mmc_dev = mmc_get_dev(mmc_host.dev_num);
    if (mmc_dev == NULL)
        data_size_in_blocks = 0;
    else
        data_size_in_blocks = data_size / mmc_dev->blksz
                             + (data_size % mmc_dev->blksz != 0);

	snprintf(runcmd.list[runcmd.count++], MAX_CMD_LEN,
		"mmc erase 0x0 0x%lx && "
		"mmc write 0x%lx 0x0 0x%lx",
		data_size_in_blocks,
		data_addr, data_size_in_blocks);
}

static int failsafe_write_ptable(const ulong data_addr, const ulong data_size)
{
	print_upgrade_hint("PTABLE");

	switch(fw_type) {
	case FW_TYPE_EMMC:
		if (!dfd->mmc) {
			handle_flash_not_found(fw_type, "EMMC");
			return RET_FLASH_NOT_FOUND;
		}
		handle_gpt_write_cmd(data_addr, data_size);
		break;
    case FW_TYPE_MIBIB_NAND:
        if (!dfd->nand) {
			handle_flash_not_found(fw_type, "NAND");
			return RET_FLASH_NOT_FOUND;
		}
		snprintf(runcmd.list[runcmd.count++], MAX_CMD_LEN,
			"flash 0:MIBIB 0x%lx 0x%lx", data_addr, data_size);
        break;
    case FW_TYPE_MIBIB_NOR:
        if (!dfd->spi) {
            handle_flash_not_found(fw_type, "SPI-NOR");
			return RET_FLASH_NOT_FOUND;
        }
		snprintf(runcmd.list[runcmd.count++], MAX_CMD_LEN,
			"flash 0:MIBIB 0x%lx 0x%lx", data_addr, data_size);
        break;
    default:
        handle_wrong_fw_type("Partition Table (GPT or MIBIB)", fw_type);
        return RET_WRONG_FW_TYPE;
    }

	return failsafe_run_command_list(&runcmd);
}

static ulong get_nand_writable_data_size(const uint32_t data_size)
{
	uint32_t adj_size, writable_size = data_size;
	nand_info_t *nand = &nand_info[CONFIG_NAND_FLASH_INFO_IDX];

	if (nand->writesize) {
		adj_size = data_size % nand->writesize;
		if (adj_size)
			writable_size += nand->writesize - adj_size;
	}

	return (ulong)writable_size;
}

static int failsafe_write_simg(const ulong data_addr, const ulong data_size)
{
	print_upgrade_hint("SIMG");

	switch (fw_type) {
	case FW_TYPE_EMMC:
		if (!dfd->mmc) {
			handle_flash_not_found(fw_type, "EMMC");
			return RET_FLASH_NOT_FOUND;
		}
		handle_gpt_write_cmd(data_addr, data_size);
		break;
	case FW_TYPE_NAND:
		if (!dfd->nand) {
			handle_flash_not_found(fw_type, "NAND");
			return RET_FLASH_NOT_FOUND;
		}
		ulong writable_size = get_nand_writable_data_size((const uint32_t)data_size);
		snprintf(runcmd.list[runcmd.count++], MAX_CMD_LEN,
			"nand erase 0x0 0x%lx && "
			"nand write 0x%lx 0x0 0x%lx",
			writable_size,
			data_addr, writable_size);
		break;
	case FW_TYPE_NOR:
		if (!dfd->spi) {
			handle_flash_not_found(fw_type, "SPI-NOR");
			return RET_FLASH_NOT_FOUND;
		}
		snprintf(runcmd.list[runcmd.count++], MAX_CMD_LEN,
			"sf probe && sf update 0x%lx 0x0 0x%lx",
			data_addr, data_size);
		break;
	default:
		handle_wrong_fw_type("Single Image", fw_type);
		return RET_WRONG_FW_TYPE;
	}

	return failsafe_run_command_list(&runcmd);
}

int failsafe_write_image(const int upgrade_type, const ulong data_addr,
			const ulong data_size, struct httpd_response *response)
{
    int ret;

	runcmd.count = 0;
	fw_type = check_fw_type((const void *)data_addr);

	memset(info, 0, sizeof(info));
	memset(resp, 0, sizeof(resp));

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
    case WEBFAILSAFE_UPGRADE_TYPE_PTABLE:
        ret = failsafe_write_ptable(data_addr, data_size);
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
