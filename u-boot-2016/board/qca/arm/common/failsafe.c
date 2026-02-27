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

#ifndef CONFIG_SDHCI_SUPPORT
extern qca_mmc mmc_host;
#else
extern struct sdhci_host mmc_host;
#endif

DECLARE_GLOBAL_DATA_PTR;

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

    fw_type = check_fw_type((const void *)data_addr);

    if (fw_type != FW_TYPE_FIT)
        return RET_WRONG_FW_TYPE;

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

	if (!ret)
		return RET_SUCCESS;
	else
		return RET_FAILURE;
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

/**
 * check_part_exist - 检查指定分区是否存在
 * @part_name: 分区名
 *
 * 若找到指定分区则返回 RET_SUCCESS，否则返回 RET_PART_NOT_FOUND。
 *
 * NOTE: 目前不支持查找 NAND FLASH 中的 UBI 卷。
 */
static int check_part_exist(char *part_name)
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
			return RET_PART_NOT_FOUND;

		ret = get_partition_info_efi_by_name(blk_dev, part_name, &disk_info);
		if (!ret)
			/* 在 eMMC 中找到指定分区 */
			return RET_SUCCESS;
	}

	/* 找不到指定分区 */
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
	printf("ERROR: image %s size (%lu bytes) > partition %s size (%lu bytes)!\n",
		file_name, file_size_in_bytes, part_name, part_size_in_bytes);
	return RET_FILE_TOO_BIG;

part_not_found:
	printf("Partition %s not found!\n", part_name);
	return RET_PART_NOT_FOUND;
}

static inline void print_file_type_error_msg(char *expected_file_type_str, int fw_type)
{
	printf("ERROR: wrong file type! (expect: %s, in fact: %s)\n",
		expected_file_type_str, fw_type_to_string(fw_type));
}

int failsafe_validate_image(const int upgrade_type,
				const void *data_addr, const ulong data_size_in_bytes)
{
	int fw_type = check_fw_type(data_addr);

#if defined(CONFIG_HTTPD_DEBUG)
	if (httpd_debug)
		printf("[DEBUG] failsafe_validate_image(): "
			"fw_type = %d (%s), data_addr = 0x%p, data_size_in_bytes = %lu\n",
			fw_type, fw_type_to_string(fw_type), data_addr, data_size_in_bytes);
#endif

	switch (upgrade_type) {
	case WEBFAILSAFE_UPGRADE_TYPE_FIRMWARE:
		switch (fw_type) {
#if defined(MACHINE_FLASH_TYPE_EMMC) || \
	defined(MACHINE_FLASH_TYPE_NORPLUSEMMC)
		case FW_TYPE_FACTORY_KERNEL6M:
			return (check_file_size_is_valid("kernel", "0:HLOS", 6*1024*1024) ||
					check_file_size_is_valid("rootfs", "rootfs", data_size_in_bytes - 6*1024*1024));
		case FW_TYPE_FACTORY_KERNEL12M:
			return (check_file_size_is_valid("kernel", "0:HLOS", 12*1024*1024) ||
					check_file_size_is_valid("rootfs", "rootfs", data_size_in_bytes - 12*1024*1024));
		case FW_TYPE_SYSUPGRADE: {
			const void *kernel_addr, *rootfs_addr;
			size_t kernel_size, rootfs_size;
			if (parse_tar_image(data_addr, (size_t)data_size_in_bytes,
								&kernel_addr, &kernel_size,
								&rootfs_addr, &rootfs_size)
			) {
				printf("ERROR: NOT valid SYSUPGRADE TAR IMAGE!\n");
				return RET_WRONG_FW_TYPE;
			}
			return (check_file_size_is_valid("kernel", "0:HLOS", (ulong)kernel_size) ||
					check_file_size_is_valid("rootfs", "rootfs", (ulong)rootfs_size));
		}
		case FW_TYPE_QSDK:
			break;
#endif
#if defined(MACHINE_FLASH_TYPE_NAND)
		case FW_TYPE_UBI:
			return (check_file_size_is_valid("total", "rootfs", data_size_in_bytes));
#endif
		default:
			print_file_type_error_msg("FIRMWARE", fw_type);
			return RET_WRONG_FW_TYPE;
		}
		break;
	case WEBFAILSAFE_UPGRADE_TYPE_UBOOT:
		if (fw_type != FW_TYPE_ELF) {
			print_file_type_error_msg("U-BOOT ELF", fw_type);
			return RET_WRONG_FW_TYPE;
		}
		return (check_file_size_is_valid("U-Boot", "0:APPSBL", data_size_in_bytes));
	case WEBFAILSAFE_UPGRADE_TYPE_ART:
		return (check_file_size_is_valid("ART", "0:ART", data_size_in_bytes));
	case WEBFAILSAFE_UPGRADE_TYPE_CDT:
		if (fw_type != FW_TYPE_CDT) {
			print_file_type_error_msg("CDT", fw_type);
			return RET_WRONG_FW_TYPE;
		}
		return (check_file_size_is_valid("CDT", "0:CDT", data_size_in_bytes));
	case WEBFAILSAFE_UPGRADE_TYPE_GPT:
		if (fw_type != FW_TYPE_EMMC) {
			print_file_type_error_msg("GPT", fw_type);
			return RET_WRONG_FW_TYPE;
		}
		break;
	case WEBFAILSAFE_UPGRADE_TYPE_MIBIB:
		if (fw_type != FW_TYPE_MIBIB_NAND && fw_type != FW_TYPE_MIBIB_NOR) {
			print_file_type_error_msg("MIBIB", fw_type);
			return RET_WRONG_FW_TYPE;
		}
		return (check_file_size_is_valid("MIBIB", "0:MIBIB", data_size_in_bytes));
	case WEBFAILSAFE_UPGRADE_TYPE_SIMG:
#if defined(MACHINE_FLASH_TYPE_EMMC)
		if (fw_type != FW_TYPE_EMMC) {
			print_file_type_error_msg("EMMC IMG", fw_type);
			return RET_WRONG_FW_TYPE;
		}
#endif
#if defined(MACHINE_FLASH_TYPE_NAND)
		if (fw_type != FW_TYPE_NAND) {
			print_file_type_error_msg("NAND IMG", fw_type);
			return RET_WRONG_FW_TYPE;
		}
#endif
#if defined(MACHINE_FLASH_TYPE_NORPLUSEMMC)
		if (fw_type != FW_TYPE_EMMC && fw_type != FW_TYPE_NOR) {
			print_file_type_error_msg("EMMC IMG or NOR IMG", fw_type);
			return RET_WRONG_FW_TYPE;
		}
#endif
		break;
	case WEBFAILSAFE_UPGRADE_TYPE_INITRAMFS:
		if (fw_type != FW_TYPE_FIT) {
			print_file_type_error_msg("FIT INITRAMFS UIMAGE", fw_type);
			return RET_WRONG_FW_TYPE;
		}
		break;
	default:
		printf("ERROR: NOT supported WEBFAILSAFE UPGRADE TYPE!\n");
		return RET_WRONG_UPGRADE_TYPE;
	}

	return RET_SUCCESS;
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
		if (fw_type == FW_TYPE_FACTORY_KERNEL6M) {
			sprintf(runcmd,
				"flash 0:HLOS 0x%lx 0x%lx && "
				"flash rootfs 0x%lx 0x%lx && "
				"bootconfig set primary",
				data_addr, (ulong)0x600000,
				(ulong)(data_addr + 0x600000), (ulong)(data_size - 0x600000)
			);
		} else if (fw_type == FW_TYPE_FACTORY_KERNEL12M) {
			sprintf(runcmd,
				"flash 0:HLOS 0x%lx 0x%lx && "
				"flash rootfs 0x%lx 0x%lx && "
				"bootconfig set primary",
				data_addr, (ulong)0xC00000,
				(ulong)(data_addr + 0xC00000), (ulong)(data_size - 0xC00000)
			);
		} else if (fw_type == FW_TYPE_QSDK) {
			// TODO: 单独判断每个分区是否存在
			sprintf(runcmd,
				"xtract_n_flash 0x%lx hlos-0cc33b23252699d495d79a843032498bfa593aba 0:HLOS && "
				"xtract_n_flash 0x%lx rootfs-f3c50b484767661151cfb641e2622703e45020fe rootfs && "
				"xtract_n_flash 0x%lx wififw-45b62ade000c18bfeeb23ae30e5a6811eac05e2f 0:WIFIFW && "
				"flasherase rootfs_data && bootconfig set primary",
				data_addr,
				data_addr,
				data_addr
			);
		} else if (fw_type == FW_TYPE_SYSUPGRADE) {
			sprintf(runcmd,
				"untar 0x%lx 0x%lx && "
				"flash 0:HLOS $kernel_addr $kernel_size && "
				"flash rootfs $rootfs_addr $rootfs_size && "
				"bootconfig set primary",
				data_addr, data_size
			);
		} else {
			return RET_WRONG_FW_TYPE;
		}
		break;
#endif
#if defined(MACHINE_FLASH_TYPE_NAND)
	case SMEM_BOOT_NAND_FLASH:
		sprintf(runcmd,
			"flash rootfs 0x%lx 0x%lx && "
			"bootconfig set primary",
			data_addr, data_size
		);
		break;
#endif
	default:
		printf("Update FIRMWARE is NOT supported for this FLASH TYPE yet!\n");
		return RET_WRONG_FLASH_TYPE;
	}

	printf("Executing: %s\n\n", runcmd);

	ret = run_command(runcmd, 0);

	if (!ret)
		return RET_SUCCESS;
	else
		return RET_FAILURE;
}

static int failsafe_write_uboot(const ulong data_addr, const ulong data_size)
{
	int ret;

    if (fw_type != FW_TYPE_ELF)
        return RET_WRONG_FW_TYPE;

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
		if (check_part_exist("0:APPSBL_1") == RET_PART_NOT_FOUND) {
			sprintf(runcmd,
				"flash 0:APPSBL 0x%lx 0x%lx",
				data_addr, data_size
			);
		} else {
			sprintf(runcmd,
				"flash 0:APPSBL 0x%lx 0x%lx && "
				"flash 0:APPSBL_1 0x%lx 0x%lx",
				data_addr, data_size,
				data_addr, data_size
			);
		}
		break;
	default:
		printf("Update U-boot is NOT supported for this FLASH TYPE yet!\n");
		return RET_WRONG_FLASH_TYPE;
	}

	printf("Executing: %s\n\n", runcmd);

	ret = run_command(runcmd, 0);

	if (!ret)
		return RET_SUCCESS;
	else
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
		printf("Update ART is NOT supported for this FLASH TYPE yet!\n");
		return RET_WRONG_FLASH_TYPE;
	}

	printf("Executing: %s\n\n", runcmd);

	ret = run_command(runcmd, 0);

	if (!ret)
		return RET_SUCCESS;
	else
		return RET_FAILURE;
}

static int failsafe_write_cdt(const ulong data_addr, const ulong data_size)
{
	int ret;

    if (fw_type != FW_TYPE_CDT)
        return RET_WRONG_FW_TYPE;

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
		if (check_part_exist("0:CDT_1") == RET_PART_NOT_FOUND) {
			sprintf(runcmd,
				"flash 0:CDT 0x%lx 0x%lx",
				data_addr, data_size
			);
		} else {
			sprintf(runcmd,
				"flash 0:CDT 0x%lx 0x%lx && "
				"flash 0:CDT_1 0x%lx 0x%lx",
				data_addr, data_size,
				data_addr, data_size
			);
		}
		break;
	default:
		printf("Update CDT is NOT supported for this FLASH TYPE yet!\n");
		return RET_WRONG_FLASH_TYPE;
	}

	printf("Executing: %s\n\n", runcmd);

	ret = run_command(runcmd, 0);

	if (!ret)
		return RET_SUCCESS;
	else
		return RET_FAILURE;
}

static int failsafe_write_gpt(const ulong data_addr, const ulong data_size)
{
	int ret;
	block_dev_desc_t *blk_dev;
    ulong data_size_in_blocks;

    blk_dev = mmc_get_dev(mmc_host.dev_num);
    if (blk_dev == NULL)
        data_size_in_blocks = 0;
    else
        data_size_in_blocks = data_size / blk_dev->blksz
                             + (data_size % blk_dev->blksz != 0);

	if (fw_type != FW_TYPE_EMMC)
		return RET_WRONG_FW_TYPE;

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
		printf("Update GPT is NOT supported for this FLASH TYPE yet!\n");
		return RET_WRONG_FLASH_TYPE;
	}

	printf("Executing: %s\n\n", runcmd);

	ret = run_command(runcmd, 0);

	if (!ret)
		return RET_SUCCESS;
	else
		return RET_FAILURE;
}

static int failsafe_write_mibib(const ulong data_addr, const ulong data_size)
{
	int ret;

	if (fw_type != FW_TYPE_MIBIB_NAND && fw_type != FW_TYPE_MIBIB_NOR)
		return RET_WRONG_FW_TYPE;

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
		printf("Update MIBIB is NOT supported for this FLASH TYPE yet!\n");
		return RET_WRONG_FLASH_TYPE;
	}

	printf("Executing: %s\n\n", runcmd);

	ret = run_command(runcmd, 0);

	if (!ret)
		return RET_SUCCESS;
	else
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
			return RET_WRONG_FW_TYPE;
		}
		break;
#endif
	default:
		printf("Update SIMG is NOT supported for this FLASH TYPE yet!\n");
		return RET_WRONG_FLASH_TYPE;
	}

	printf("Executing: %s\n\n", runcmd);

	ret = run_command(runcmd, 0);

	if (!ret)
		return RET_SUCCESS;
	else
		return RET_FAILURE;
}

int failsafe_write_image(const int upgrade_type,
				const ulong data_addr, const ulong data_size)
{
    int ret;

	fw_type = check_fw_type((const void *)data_addr);
	flash_type = check_flash_type();

    memset(runcmd, 0, sizeof(runcmd));

    // TODO: LED 控制
    // led_control("ledblink", "blink_led", "100");

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

    // led_control("ledblink", "blink_led", "0");

    return ret;
}
