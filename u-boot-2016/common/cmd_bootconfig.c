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
#include <spi.h>
#include <spi_flash.h>
#include <malloc.h>
#include <mapmem.h>
#include <errno.h>
#include <ipq_api.h>
#include <flashrw.h>

#ifndef CONFIG_SDHCI_SUPPORT
extern qca_mmc mmc_host;
#else
extern struct sdhci_host mmc_host;
#endif

#define BOOTCONFIG_PART_NAME    "0:BOOTCONFIG"
#define BOOTCONFIG1_PART_NAME   "0:BOOTCONFIG1"
#define ALT_PART_NAME_LENGTH    16
#define NUM_ALT_PARTITION       16
#define BOOTCONFIG_MAGIC_START          0xA3A2A1A0
#define BOOTCONFIG_MAGIC_START_TRYMODE  0xA3A2A1A1
#define BOOTCONFIG_MAGIC_END            0xB3B2B1B0

/* Custom bootconfig structure with packed attribute to ensure correct layout */
struct bootconfig_part_entry {
	char name[ALT_PART_NAME_LENGTH];
	uint32_t primaryboot;
} __attribute__ ((__packed__));

struct bootconfig_info {
	uint32_t magic_start;
	uint32_t age;
	uint32_t numaltpart;
	struct bootconfig_part_entry per_part_entry[NUM_ALT_PARTITION];
	uint32_t magic_end;
} __attribute__ ((__packed__));

typedef struct {
	const char *part_name; /* BOOTCONFIG 分区名 */
	ulong offset; /* BOOTCONFIG 分区偏移量 */
	size_t size; /* BOOTCONFIG 有效数据大小 */
	struct bootconfig_info info;
} bootconfig_info_t;

static qca_smem_flash_info_t *sfi = &qca_smem_flash_info;
static detected_flash_device_t *dfd = &detected_flash_device;

/**
 * get_bootconfig_part_offset - Get bootconfig partition offset
 */
static int get_bootconfig_part_offset(const char *part_name)
{
	block_dev_desc_t *mmc_dev;
	disk_partition_t disk_info = {0};
	uint32_t offset_bytes = 0, size_bytes = 0;
	int ret;

	switch (sfi->flash_type) {
	case SMEM_BOOT_NAND_FLASH:
	case SMEM_BOOT_NOR_FLASH:
	case SMEM_BOOT_NORPLUSEMMC:
	case SMEM_BOOT_NORPLUSNAND:
	case SMEM_BOOT_ONENAND_FLASH:
	case SMEM_BOOT_QSPI_NAND_FLASH:
	case SMEM_BOOT_SPI_FLASH:
		ret = getpart_offset_size((char *)part_name, &offset_bytes, &size_bytes);
		if (ret)
			return -ENOENT;
		return offset_bytes;
	case SMEM_BOOT_MMC_FLASH:
	case SMEM_BOOT_NO_FLASH:
	case SMEM_BOOT_SDC_FLASH:
		if (!dfd->mmc)
			return -ENODEV;
		mmc_dev = mmc_get_dev(mmc_host.dev_num);
		if (!mmc_dev)
			return -ENODEV;
		ret = get_partition_info_efi_by_name(mmc_dev, (char *)part_name, &disk_info);
		if (ret)
			return -ENOENT;
		return disk_info.start * disk_info.blksz;
	default:
		puts("Unsupported flash type\n");
		return -EINVAL;
	}
}

/**
 * read_bootconfig - Read bootconfig data to bootcfg structure
 */
static int read_bootconfig(const char *part_name, bootconfig_info_t *bootcfg, int ignore_error)
{
	int offset_bytes, ret;

	offset_bytes = get_bootconfig_part_offset(part_name);
	if (offset_bytes < 0) {
		printf("Partition %s not found\n", part_name);
		return -ENOENT;
	}

	bootcfg->offset = offset_bytes;

	switch (sfi->flash_type) {
	case SMEM_BOOT_NOR_FLASH:
	case SMEM_BOOT_NORPLUSEMMC:
	case SMEM_BOOT_NORPLUSNAND:
	case SMEM_BOOT_SPI_FLASH:
		ret = read_data_from_spi(bootcfg->offset,
			bootcfg->size, &bootcfg->info, bootcfg->size);
		break;
	case SMEM_BOOT_NAND_FLASH:
	case SMEM_BOOT_ONENAND_FLASH:
	case SMEM_BOOT_QSPI_NAND_FLASH:
		ret = read_data_from_nand(bootcfg->offset,
			bootcfg->size, &bootcfg->info, bootcfg->size);
		break;
	case SMEM_BOOT_MMC_FLASH:
	case SMEM_BOOT_NO_FLASH:
	case SMEM_BOOT_SDC_FLASH:
		ret = read_data_from_mmc(bootcfg->offset,
			bootcfg->size, &bootcfg->info, bootcfg->size);
		break;
	default:
		puts("Unsupported flash type\n");
		return -EINVAL;
	}

	if (ret) {
		printf("Failed to read bootconfig from partition %s\n", part_name);
		return ret;
	}

	/* Validate magic numbers */
	if (!ignore_error && bootcfg->info.magic_start != BOOTCONFIG_MAGIC_START &&
	    bootcfg->info.magic_start != BOOTCONFIG_MAGIC_START_TRYMODE) {
		printf("Invalid magic_start: 0x%08x in %s\n", bootcfg->info.magic_start, part_name);
		return -EINVAL;
	}

	if (!ignore_error && bootcfg->info.magic_end != BOOTCONFIG_MAGIC_END) {
		printf("Invalid magic_end: 0x%08x in %s\n", bootcfg->info.magic_end, part_name);
		return -EINVAL;
	}

	if (!ignore_error && bootcfg->info.numaltpart > NUM_ALT_PARTITION) {
		printf("Warning: numaltpart (%u) exceeds maximum (%d), truncating\n",
		       bootcfg->info.numaltpart, NUM_ALT_PARTITION);
		bootcfg->info.numaltpart = NUM_ALT_PARTITION;
	}

	return 0;
}

/**
 * write_bootconfig - Write bootconfig data back to partition
 */
static int write_bootconfig(bootconfig_info_t *bootcfg)
{
	int ret;

	switch (sfi->flash_type) {
	case SMEM_BOOT_NOR_FLASH:
	case SMEM_BOOT_NORPLUSEMMC:
	case SMEM_BOOT_NORPLUSNAND:
	case SMEM_BOOT_SPI_FLASH:
		ret = write_data_to_spi(bootcfg->offset, bootcfg->size, &bootcfg->info);
		break;
	case SMEM_BOOT_NAND_FLASH:
	case SMEM_BOOT_ONENAND_FLASH:
	case SMEM_BOOT_QSPI_NAND_FLASH:
		ret = write_data_to_nand(bootcfg->offset, bootcfg->size, &bootcfg->info);
		break;
	case SMEM_BOOT_MMC_FLASH:
	case SMEM_BOOT_NO_FLASH:
	case SMEM_BOOT_SDC_FLASH:
		ret = write_data_to_mmc(bootcfg->offset, bootcfg->size, &bootcfg->info);
		break;
	default:
		puts("Unsupported flash type\n");
		return -EINVAL;
	}

	if (ret) {
		printf("Failed to write bootconfig partition at offset: 0x%lx\n", bootcfg->offset);
		return ret;
	}

	return 0;
}

/**
 * compare_bootconfig - Compare two bootconfig structures
 */
static int compare_bootconfig(bootconfig_info_t *cfg1, bootconfig_info_t *cfg2)
{
	if (cfg1->info.magic_start != cfg2->info.magic_start ||
	    cfg1->info.magic_end != cfg2->info.magic_end ||
	    cfg1->info.age != cfg2->info.age ||
	    cfg1->info.numaltpart != cfg2->info.numaltpart) {
		return 0; /* Not equal */
	}

	return memcmp(cfg1->info.per_part_entry, cfg2->info.per_part_entry,
		      sizeof(cfg1->info.per_part_entry)) == 0;
}

/**
 * do_bootconfig_sync - Sync 0:BOOTCONFIG1 with 0:BOOTCONFIG or vice versa
 */
static int do_bootconfig_sync(bool reverse)
{
	bootconfig_info_t src, dst;
	int ret;

	/* Check if 0:BOOTCONFIG1 partition exists */
	ret = get_bootconfig_part_offset(BOOTCONFIG1_PART_NAME);
	if (ret < 0) {
		printf("Partition %s does not exist, skip sync\n", BOOTCONFIG1_PART_NAME);
		return CMD_RET_SUCCESS;
	}

	if (reverse) {
		/* 0:BOOTCONFIG1 -> 0:BOOTCONFIG */
		src.part_name = BOOTCONFIG1_PART_NAME;
		dst.part_name = BOOTCONFIG_PART_NAME;
	} else {
		/* 0:BOOTCONFIG -> 0:BOOTCONFIG1 */
		src.part_name = BOOTCONFIG_PART_NAME;
		dst.part_name = BOOTCONFIG1_PART_NAME;
	}

	src.size = sizeof(struct bootconfig_info);
	dst.size = sizeof(struct bootconfig_info);

	/* Read source BOOTCONFIG partition */
	ret = read_bootconfig(src.part_name, &src, 0);
	if (ret)
		return CMD_RET_FAILURE;

	/* Read destination BOOTCONFIG partition */
	ret = read_bootconfig(dst.part_name, &dst, 1);
	if (ret)
		return CMD_RET_FAILURE;

	printf("Syncing %s -> %s: ", src.part_name, dst.part_name);

	/* Compare the two bootconfig structures */
	ret = compare_bootconfig(&src, &dst);
	if (ret) {
		puts("already in sync\n\n");
		return CMD_RET_SUCCESS;
	}

	/* They are different, need to sync */
	memcpy(&dst.info, &src.info, src.size);

	ret = write_bootconfig(&dst);
	if (!ret) {
		puts("success\n\n");
		return CMD_RET_SUCCESS;
	} else {
		printf("failure (errno: %d)\n\n", ret);
		return CMD_RET_FAILURE;
	}
}

/**
 * do_bootconfig_print - Print all bootconfig information
 */
static int do_bootconfig_print(void)
{
	bootconfig_info_t bootcfg;
	int i, ret;

	bootcfg.size = sizeof(struct bootconfig_info);

	ret = read_bootconfig(BOOTCONFIG_PART_NAME, &bootcfg, 0);
	if (ret)
		return CMD_RET_FAILURE;

	printf("\n========== Bootconfig Information ==========\n");
	printf("Magic Start:      0x%08x %s\n", bootcfg.info.magic_start,
	       bootcfg.info.magic_start == BOOTCONFIG_MAGIC_START ? "(Normal)" :
	       bootcfg.info.magic_start == BOOTCONFIG_MAGIC_START_TRYMODE ? "(Try Mode)" : "(Unknown)");
	printf("Magic End:        0x%08x\n", bootcfg.info.magic_end);
	printf("Age:              0x%08x\n", bootcfg.info.age);
	printf("Number of Alt Partitions: %u\n", bootcfg.info.numaltpart);
	printf("\n%-3s %-16s %s\n", "Idx", "Partition Name", "Primary Boot");
	printf("--------------------------------------------\n");

	for (i = 0; i < bootcfg.info.numaltpart && i < NUM_ALT_PARTITION; i++) {
		printf("%3d: %-16s %u\n", i, bootcfg.info.per_part_entry[i].name,
		       bootcfg.info.per_part_entry[i].primaryboot);
	}
	printf("============================================\n\n");

	return CMD_RET_SUCCESS;
}

/**
 * do_bootconfig_get - Get primaryboot value for a partition
 */
static int do_bootconfig_get(char *part_name)
{
	bootconfig_info_t bootcfg;
	int i, ret;

	bootcfg.size = sizeof(struct bootconfig_info);

	ret = read_bootconfig(BOOTCONFIG_PART_NAME, &bootcfg, 0);
	if (ret)
		return CMD_RET_FAILURE;

	for (i = 0; i < bootcfg.info.numaltpart && i < NUM_ALT_PARTITION; i++) {
		if (strncmp(bootcfg.info.per_part_entry[i].name, part_name,
			    ALT_PART_NAME_LENGTH) == 0) {
			printf("%s = %u\n", part_name, bootcfg.info.per_part_entry[i].primaryboot);
			return CMD_RET_SUCCESS;
		}
	}

	printf("Partition '%s' not found\n", part_name);
	return CMD_RET_FAILURE;
}

/**
 * do_bootconfig_set - Set primaryboot value for partition(s)
 */
static int do_bootconfig_set(char *part_name, uint32_t value)
{
	bootconfig_info_t bootcfg;
	int i, modified = 0;
	int ret;

	if (value != 0 && value != 1) {
		printf("Invalid value: %u (must be 0 or 1)\n", value);
		return CMD_RET_FAILURE;
	}

	bootcfg.size = sizeof(struct bootconfig_info);

	ret = read_bootconfig(BOOTCONFIG_PART_NAME, &bootcfg, 0);
	if (ret)
		return CMD_RET_FAILURE;

	/* Handle "all" special case */
	if (strcmp(part_name, "all") == 0) {
		for (i = 0; i < bootcfg.info.numaltpart && i < NUM_ALT_PARTITION; i++) {
			if (bootcfg.info.per_part_entry[i].primaryboot != value) {
				bootcfg.info.per_part_entry[i].primaryboot = value;
				modified++;
				printf("Set %s to %u\n", bootcfg.info.per_part_entry[i].name, value);
			} else {
				printf("%s already %u\n", bootcfg.info.per_part_entry[i].name, value);
			}
		}
		if (modified == 0)
			printf("All partitions already have value %u, no change\n", value);
	} else if (strcmp(part_name, "firmware") == 0) {
		/* Handle firmware partitions */
		const char *fw_parts[] = {
			"0:HLOS",
			"rootfs",
			"0:WIFIFW"
		};
		for (i = 0; i < bootcfg.info.numaltpart && i < NUM_ALT_PARTITION; i++) {
			for (int j = 0; j < ARRAY_SIZE(fw_parts); j++) {
				if (strncmp(bootcfg.info.per_part_entry[i].name, fw_parts[j],
						ALT_PART_NAME_LENGTH) == 0) {
					if (bootcfg.info.per_part_entry[i].primaryboot != value) {
						bootcfg.info.per_part_entry[i].primaryboot = value;
						modified++;
						printf("Set %s to %u\n", fw_parts[j], value);
					} else {
						printf("%s already %u\n", fw_parts[j], value);
					}
					break;
				}
			}
		}
		if (modified == 0)
			printf("All firmware partitions already have value %u, no change\n", value);
	} else {
		/* Handle specific partition */
		for (i = 0; i < bootcfg.info.numaltpart && i < NUM_ALT_PARTITION; i++) {
			if (strncmp(bootcfg.info.per_part_entry[i].name, part_name,
				    ALT_PART_NAME_LENGTH) == 0) {
				if (bootcfg.info.per_part_entry[i].primaryboot != value) {
					bootcfg.info.per_part_entry[i].primaryboot = value;
					modified = 1;
					printf("Set %s to %u\n", part_name, value);
				} else {
					printf("%s already %u, no change\n", part_name, value);
				}
				break;
			}
		}
		if (i >= bootcfg.info.numaltpart || i >= NUM_ALT_PARTITION) {
			printf("Partition entry '%s' not found\n", part_name);
			return CMD_RET_FAILURE;
		}
	}

	/* Only write back if modifications were made */
	if (modified) {
		ret = write_bootconfig(&bootcfg);
		if (ret)
			return CMD_RET_FAILURE;
		puts("\nBootconfig updated successfully\n\n");
	}

	/* Always sync 0:BOOTCONFIG -> 0:BOOTCONFIG1 */
	return do_bootconfig_sync(false);
}

/**
 * do_bootconfig - Main bootconfig command handler
 */
static int do_bootconfig(cmd_tbl_t *cmdtp, int flag, int argc, char * const argv[])
{
	if (argc < 2)
		return CMD_RET_USAGE;

	/* bootconfig print */
	if (strcmp(argv[1], "print") == 0)
		return do_bootconfig_print();

	/* bootconfig sync */
	if (strcmp(argv[1], "sync") == 0) {
		if (argc > 2) {
			if (strcmp(argv[2], "reverse") == 0) {
				return do_bootconfig_sync(true);
			} else {
				puts("Usage: bootconfig sync [reverse]\n");
				return CMD_RET_USAGE;
			}
		} else {
			return do_bootconfig_sync(false);
		}
	}

	/* bootconfig get <name> */
	if (strcmp(argv[1], "get") == 0) {
		if (argc < 3) {
			puts("Usage: bootconfig get <partition_name>\n");
			return CMD_RET_USAGE;
		}
		return do_bootconfig_get(argv[2]);
	}

	/* bootconfig set <name|firmware|all> <0|1> */
	if (strcmp(argv[1], "set") == 0) {
		if (argc < 4) {
			puts("Usage: bootconfig set <partition_name|all> <0|1>\n");
			return CMD_RET_USAGE;
		}
		return do_bootconfig_set(argv[2], simple_strtoul(argv[3], NULL, 0));
	}

	return CMD_RET_USAGE;
}

U_BOOT_CMD(
	bootconfig, 4, 0, do_bootconfig,
	"manage boot configuration",
	"bootconfig print           - Print all bootconfig information\n"
	"bootconfig sync [reverse]  - Sync 0:BOOTCONFIG1 with 0:BOOTCONFIG or vice versa\n"
	"bootconfig get <name>      - Get primaryboot value for a partition\n"
	"bootconfig set <name|firmware|all> <0|1> - Set primaryboot value for partition(s)\n"
	"\n"
	"Examples:\n"
	"  bootconfig print                    - Display all bootconfig info\n"
	"  bootconfig sync                     - Sync 0:BOOTCONFIG -> 0:BOOTCONFIG1\n"
	"  bootconfig sync reverse             - Sync 0:BOOTCONFIG1 -> 0:BOOTCONFIG\n"
	"  bootconfig get rootfs               - Get rootfs primaryboot value\n"
	"  bootconfig set rootfs 1             - Set rootfs primaryboot to 1\n"
	"  bootconfig set firmware 0           - Set firmware partitions (0:HLOS, rootfs, 0:WIFIFW) to 0\n"
	"  bootconfig set all 0                - Set all partitions to 0\n"
);
