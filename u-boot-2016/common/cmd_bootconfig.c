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
#include <mapmem.h>
#include <errno.h>

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

/**
 * get_bootconfig_partition_info - Get bootconfig partition offset and size
 */
static int get_bootconfig_partition_info(const char *part_name,
				uint32_t *offset, uint32_t *size)
{
	qca_smem_flash_info_t *sfi = &qca_smem_flash_info;
	block_dev_desc_t *mmc_dev;
	disk_partition_t disk_info = {0};
	uint32_t offset_in_blocks = 0, size_in_blocks = 0;
	uint32_t offset_in_bytes = 0, size_in_bytes = 0;
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
		if (ret)
			return -ENOENT;
		offset_in_bytes = sfi->flash_block_size * offset_in_blocks;
		size_in_bytes = sfi->flash_block_size * size_in_blocks;
		break;

	case SMEM_BOOT_MMC_FLASH:
	case SMEM_BOOT_NO_FLASH:
	case SMEM_BOOT_SDC_FLASH:
		mmc_dev = mmc_get_dev(mmc_host.dev_num);
		if (mmc_dev == NULL)
			return -ENODEV;
		ret = get_partition_info_efi_by_name(mmc_dev, (char *)part_name, &disk_info);
		if (ret)
			return -ENOENT;
		offset_in_bytes = (uint32_t)(disk_info.start * disk_info.blksz);
		size_in_bytes = (uint32_t)(disk_info.size * disk_info.blksz);
		break;

	default:
		return -EINVAL;
	}

	if (offset)
		*offset = offset_in_bytes;
	if (size)
		*size = size_in_bytes;

	return 0;
}

/**
 * read_bootconfig - Read bootconfig partition and copy data to bootcfg structure
 */
static int read_bootconfig(const char *part_name, struct bootconfig_info *bootcfg)
{
	qca_smem_flash_info_t *sfi = &qca_smem_flash_info;
	uint32_t offset, size;
	char buf[128];
	void *load_addr;
	int ret;

	ret = get_bootconfig_partition_info(part_name, &offset, &size);
	if (ret) {
		printf("Partition %s not found\n", part_name);
		return ret;
	}

	if (size < sizeof(struct bootconfig_info)) {
		printf("Partition %s size too small for bootconfig\n", part_name);
		return -ENOSPC;
	}

	load_addr = map_sysmem(CONFIG_SYS_LOAD_ADDR, size);
	if (!load_addr) {
		printf("Failed to map memory\n");
		return -ENOMEM;
	}

	switch (sfi->flash_type) {
	case SMEM_BOOT_NOR_FLASH:
	case SMEM_BOOT_NORPLUSEMMC:
	case SMEM_BOOT_NORPLUSNAND:
	case SMEM_BOOT_SPI_FLASH:
		sprintf(buf, "sf probe && sf read 0x%lx 0x%lx 0x%lx",
			(ulong)CONFIG_SYS_LOAD_ADDR, (ulong)offset, (ulong)size);
		break;
	case SMEM_BOOT_NAND_FLASH:
	case SMEM_BOOT_ONENAND_FLASH:
	case SMEM_BOOT_QSPI_NAND_FLASH:
		sprintf(buf, "nand read 0x%lx 0x%lx 0x%lx",
			(ulong)CONFIG_SYS_LOAD_ADDR, (ulong)offset, (ulong)size);
		break;
	case SMEM_BOOT_MMC_FLASH:
	case SMEM_BOOT_NO_FLASH:
	case SMEM_BOOT_SDC_FLASH:
		sprintf(buf, "mmc read 0x%lx 0x%lx 0x%lx",
			(ulong)CONFIG_SYS_LOAD_ADDR, (ulong)(offset / 512), (ulong)(size / 512));
		break;
	default:
		unmap_sysmem(load_addr);
		printf("Unsupported flash type\n");
		return -EINVAL;
	}

	ret = run_command(buf, 0);
	if (ret) {
		unmap_sysmem(load_addr);
		printf("Failed to read bootconfig partition %s\n", part_name);
		return ret;
	}

	/* Copy data to bootcfg structure */
	memcpy(bootcfg, load_addr, sizeof(struct bootconfig_info));
	unmap_sysmem(load_addr);

	/* Validate magic numbers */
	if (bootcfg->magic_start != BOOTCONFIG_MAGIC_START &&
	    bootcfg->magic_start != BOOTCONFIG_MAGIC_START_TRYMODE) {
		printf("Invalid magic_start: 0x%08x in %s\n", bootcfg->magic_start, part_name);
		return -EINVAL;
	}

	if (bootcfg->magic_end != BOOTCONFIG_MAGIC_END) {
		printf("Invalid magic_end: 0x%08x in %s\n", bootcfg->magic_end, part_name);
		return -EINVAL;
	}

	if (bootcfg->numaltpart > NUM_ALT_PARTITION) {
		printf("Warning: numaltpart (%u) exceeds maximum (%d), truncating\n",
		       bootcfg->numaltpart, NUM_ALT_PARTITION);
		bootcfg->numaltpart = NUM_ALT_PARTITION;
	}

	return 0;
}

/**
 * write_bootconfig - Write bootconfig data back to partition
 */
static int write_bootconfig(const char *part_name, struct bootconfig_info *bootcfg)
{
	char buf[128];
	void *load_addr;
	int ret;

	load_addr = map_sysmem(CONFIG_SYS_LOAD_ADDR, sizeof(struct bootconfig_info));
	if (!load_addr) {
		printf("Failed to map memory\n");
		return -ENOMEM;
	}

	memset(load_addr, 0, 1024);
	memcpy(load_addr, bootcfg, sizeof(struct bootconfig_info));

	sprintf(buf, "flash %s 0x%lx 0x%lx",
		part_name, (ulong)CONFIG_SYS_LOAD_ADDR, (ulong)sizeof(struct bootconfig_info));

	ret = run_command(buf, 0);
	unmap_sysmem(load_addr);
	if (ret) {
		printf("Failed to write bootconfig partition %s\n", part_name);
		return ret;
	}

	return 0;
}

/**
 * compare_bootconfig - Compare two bootconfig structures
 */
static int compare_bootconfig(struct bootconfig_info *cfg1, struct bootconfig_info *cfg2)
{
	if (cfg1->magic_start != cfg2->magic_start ||
	    cfg1->magic_end != cfg2->magic_end ||
	    cfg1->age != cfg2->age ||
	    cfg1->numaltpart != cfg2->numaltpart) {
		return 0; /* Not equal */
	}

	return memcmp(cfg1->per_part_entry, cfg2->per_part_entry,
		      sizeof(cfg1->per_part_entry)) == 0;
}

/**
 * do_bootconfig_sync - Sync BOOTCONFIG1 with BOOTCONFIG
 */
static int do_bootconfig_sync(void)
{
	struct bootconfig_info bootcfg;
	struct bootconfig_info bootcfg1;
	int ret;

	/* Check if BOOTCONFIG1 partition exists */
	ret = get_bootconfig_partition_info(BOOTCONFIG1_PART_NAME, NULL, NULL);
	if (ret == -ENOENT) {
		printf("Partition %s does not exist, skip sync\n", BOOTCONFIG1_PART_NAME);
		return CMD_RET_SUCCESS;
	}

	/* Read BOOTCONFIG partition */
	ret = read_bootconfig(BOOTCONFIG_PART_NAME, &bootcfg);
	if (ret) {
		printf("Failed to read %s partition\n", BOOTCONFIG_PART_NAME);
		return CMD_RET_FAILURE;
	}

	/* Read BOOTCONFIG1 partition */
	ret = read_bootconfig(BOOTCONFIG1_PART_NAME, &bootcfg1);
	if (ret) {
		printf("Failed to read %s partition\n", BOOTCONFIG1_PART_NAME);
		return CMD_RET_FAILURE;
	}

	/* Compare the two bootconfig structures */
	ret = compare_bootconfig(&bootcfg, &bootcfg1);
	if (ret) {
		printf("\n✓ BOOTCONFIG and BOOTCONFIG1 are already in sync\n");
		return CMD_RET_SUCCESS;
	}

	/* They are different, need to sync */
	printf("\n✗ BOOTCONFIG and BOOTCONFIG1 are inconsistent\n");
	printf("Syncing BOOTCONFIG1 with BOOTCONFIG...\n");

	/* Write BOOTCONFIG data to BOOTCONFIG1 partition */
	ret = write_bootconfig(BOOTCONFIG1_PART_NAME, &bootcfg);
	if (!ret) {
		printf("\n✓ BOOTCONFIG1 successfully synced with BOOTCONFIG\n");
		return CMD_RET_SUCCESS;
	} else {
		printf("\n✗ Failed to sync BOOTCONFIG1 with BOOTCONFIG\n");
		return CMD_RET_FAILURE;
	}
}

/**
 * do_bootconfig_print - Print all bootconfig information
 */
static int do_bootconfig_print(void)
{
	struct bootconfig_info bootcfg;
	int i, ret;

	ret = read_bootconfig(BOOTCONFIG_PART_NAME, &bootcfg);
	if (ret)
		return CMD_RET_FAILURE;

	printf("\n========== Bootconfig Information ==========\n");
	printf("Magic Start:      0x%08x %s\n", bootcfg.magic_start,
	       bootcfg.magic_start == BOOTCONFIG_MAGIC_START ? "(Normal)" :
	       bootcfg.magic_start == BOOTCONFIG_MAGIC_START_TRYMODE ? "(Try Mode)" : "(Unknown)");
	printf("Magic End:        0x%08x\n", bootcfg.magic_end);
	printf("Age:              0x%08x\n", bootcfg.age);
	printf("Number of Alt Partitions: %u\n", bootcfg.numaltpart);
	printf("\n%-3s %-16s %s\n", "Idx", "Partition Name", "Primary Boot");
	printf("--------------------------------------------\n");

	for (i = 0; i < bootcfg.numaltpart && i < NUM_ALT_PARTITION; i++) {
		printf("%3d: %-16s %u\n", i, bootcfg.per_part_entry[i].name,
		       bootcfg.per_part_entry[i].primaryboot);
	}
	printf("============================================\n\n");

	return CMD_RET_SUCCESS;
}

/**
 * do_bootconfig_get - Get primaryboot value for a partition
 */
static int do_bootconfig_get(char *part_name)
{
	struct bootconfig_info bootcfg;
	int i, ret;

	ret = read_bootconfig(BOOTCONFIG_PART_NAME, &bootcfg);
	if (ret)
		return CMD_RET_FAILURE;

	for (i = 0; i < bootcfg.numaltpart && i < NUM_ALT_PARTITION; i++) {
		if (strncmp(bootcfg.per_part_entry[i].name, part_name,
			    ALT_PART_NAME_LENGTH) == 0) {
			printf("%s = %u\n", part_name, bootcfg.per_part_entry[i].primaryboot);
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
	struct bootconfig_info bootcfg;
	int i, modified = 0;
	int ret;

	if (value != 0 && value != 1) {
		printf("Invalid value: %u (must be 0 or 1)\n", value);
		return CMD_RET_FAILURE;
	}

	ret = read_bootconfig(BOOTCONFIG_PART_NAME, &bootcfg);
	if (ret)
		return CMD_RET_FAILURE;

	/* Handle "all" special case */
	if (strcmp(part_name, "all") == 0) {
		for (i = 0; i < bootcfg.numaltpart && i < NUM_ALT_PARTITION; i++) {
			if (bootcfg.per_part_entry[i].primaryboot != value) {
				bootcfg.per_part_entry[i].primaryboot = value;
				modified++;
				printf("Set %s to %u\n", bootcfg.per_part_entry[i].name, value);
			}
		}
		if (modified == 0) {
			printf("All partitions already have value %u, no change\n", value);
			return CMD_RET_SUCCESS;
		}
	} else {
		/* Handle specific partition */
		for (i = 0; i < bootcfg.numaltpart && i < NUM_ALT_PARTITION; i++) {
			if (strncmp(bootcfg.per_part_entry[i].name, part_name,
				    ALT_PART_NAME_LENGTH) == 0) {
				uint32_t old_value = bootcfg.per_part_entry[i].primaryboot;
				if (old_value != value) {
					bootcfg.per_part_entry[i].primaryboot = value;
					modified = 1;
					printf("Set %s from %u to %u\n", part_name, old_value, value);
				} else {
					printf("%s already %u, no change\n", part_name, value);
					return CMD_RET_SUCCESS;
				}
				break;
			}
		}
		if (i >= bootcfg.numaltpart || i >= NUM_ALT_PARTITION) {
			printf("Partition '%s' not found\n", part_name);
			return CMD_RET_FAILURE;
		}
	}

	/* Only write back if modifications were made */
	if (modified) {
		ret = write_bootconfig(BOOTCONFIG_PART_NAME, &bootcfg);
		if (!ret) {
			printf("Bootconfig updated successfully\n");
			return CMD_RET_SUCCESS;
		} else {
			printf("Failed to write bootconfig\n");
			return CMD_RET_FAILURE;
		}
	}

	return CMD_RET_SUCCESS;
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
	if (strcmp(argv[1], "sync") == 0)
		return do_bootconfig_sync();

	/* bootconfig get <name> */
	if (strcmp(argv[1], "get") == 0) {
		if (argc < 3) {
			printf("Usage: bootconfig get <partition_name>\n");
			return CMD_RET_USAGE;
		}
		return do_bootconfig_get(argv[2]);
	}

	/* bootconfig set <name|all> <0|1> */
	if (strcmp(argv[1], "set") == 0) {
		if (argc < 4) {
			printf("Usage: bootconfig set <partition_name|all> <0|1>\n");
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
	"bootconfig sync            - Compare and sync BOOTCONFIG1 with BOOTCONFIG\n"
	"bootconfig get <name>      - Get primaryboot value for a partition\n"
	"bootconfig set <name|all> <0|1> - Set primaryboot value for partition(s)\n"
	"\n"
	"Examples:\n"
	"  bootconfig print                    - Display all bootconfig info\n"
	"  bootconfig sync                     - Check and sync BOOTCONFIG1 with BOOTCONFIG\n"
	"  bootconfig get rootfs               - Get rootfs primaryboot value\n"
	"  bootconfig set rootfs 1             - Set rootfs primaryboot to 1\n"
	"  bootconfig set all 0                - Set all partitions to 0\n"
);
