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
#include <memalign.h>
#include <part.h>
#include <linux/mtd/mtd.h>
#include <nand.h>
#include <mmc.h>
#include <sdhci.h>
#include <spi.h>
#include <spi_flash.h>
#include <ipq_api.h>
#include <flashrw.h>

#ifndef CONFIG_SDHCI_SUPPORT
extern qca_mmc mmc_host;
#else
extern struct sdhci_host mmc_host;
#endif

static detected_flash_device_t *dfd = &detected_flash_device;

int read_data_from_spi(ulong offset, size_t size, void *buf, size_t buf_size)
{
    struct spi_flash *spi;
    int ret;

    if (!dfd->spi)
        return -ENODEV;

    spi = spi_flash_probe(CONFIG_SF_DEFAULT_BUS, CONFIG_SF_DEFAULT_CS,
            CONFIG_SF_DEFAULT_SPEED, CONFIG_SF_DEFAULT_MODE);
    if (!spi)
        return -ENODEV;

    if (offset + size > spi->size) {
        printf("Error: read beyond flash end (0x%lx + 0x%zx > 0x%lx)\n",
            offset, size, (ulong)spi->size);
        return -ENOSPC;
    }

    if (size > buf_size) {
        printf("Error: read size exceeds buffer size (0x%zx > 0x%zx)\n",
            size, buf_size);
        return -ENOSPC;
    }

    ret = spi_flash_read(spi, offset, size, buf);
    if (ret) {
        puts("SF: read failed\n");
        return -EIO;
    }

    return 0;
}

int read_data_from_nand(ulong offset, size_t size, void *buf, size_t buf_size)
{
    nand_info_t *nand = &nand_info[CONFIG_NAND_FLASH_INFO_IDX];
    ulong off, adj_offset;
    size_t adj_size, readsize;
	void *tmp_buf;
    int ret;

    if (!dfd->nand)
        return -ENODEV;

    if (offset + size > nand->size) {
        printf("Error: read beyond flash end (0x%lx + 0x%zx > 0x%lx)\n",
            offset, size, (ulong)nand->size);
        return -ENOSPC;
    }

    if (size > buf_size) {
        printf("Error: read size exceeds buffer size (0x%zx > 0x%zx)\n",
            size, buf_size);
        return -ENOSPC;
    }

    off = offset % nand->writesize;

    if (off) {
        adj_offset = offset - off;
        adj_size = size + off;
        readsize = adj_size;

        tmp_buf = malloc(adj_size);
        if (!tmp_buf) {
            printf("Error: Cannot allocate %zu bytes\n", adj_size);
            return -ENOMEM;
        }

        ret = nand_read_skip_bad(nand, adj_offset, &readsize,
                NULL, adj_size, (u_char *)tmp_buf);
        memcpy(buf, tmp_buf + off, size);
        free(tmp_buf);
    } else {
        readsize = size;
        ret = nand_read_skip_bad(nand, offset, &readsize,
                NULL, buf_size, (u_char *)buf);
    }

    if (ret) {
        puts("NAND: read failed\n");
        return -EIO;
    }

    return 0;
}

int read_data_from_mmc(u64 offset, size_t size, void *buf, size_t buf_size)
{
    struct mmc *mmc;
    block_dev_desc_t *bd;
    ulong off, start_block, end_block;
	ulong readblks, num_blocks;
	void *tmp_buf;

    if (!dfd->mmc)
        return -ENODEV;

    mmc = find_mmc_device(mmc_host.dev_num);
    if (!mmc)
        return -ENODEV;

    if (offset + size > mmc->capacity_user) {
        printf("Error: read beyond flash end (0x%llx + 0x%zx > 0x%llx)\n",
            offset, size, mmc->capacity_user);
        return -ENOSPC;
    }

    if (size > buf_size) {
        printf("Error: read size exceeds buffer size (0x%zx > 0x%zx)\n",
            size, buf_size);
        return -ENOSPC;
    }

    bd = &mmc->block_dev;

    off = offset % bd->blksz; /* 块内偏移（单位：字节） */
	start_block = offset / bd->blksz; /* 起始块 */
	end_block = (offset + size - 1) / bd->blksz; /* 结束块 */
	num_blocks = end_block - start_block + 1; /* 需要读取的块数 */

    tmp_buf = malloc(num_blocks * bd->blksz);
    if (!tmp_buf) {
        printf("Error: Cannot allocate %lu bytes\n", num_blocks * bd->blksz);
        return -ENOMEM;
    }

    readblks = bd->block_read(mmc_host.dev_num, start_block, num_blocks, tmp_buf);

    memcpy(buf, tmp_buf + off, size);

	free(tmp_buf);

    return (readblks == num_blocks) ? 0 : -EIO;
}

int write_data_to_spi(ulong offset, size_t size, const void *buf)
{
    struct spi_flash *spi;
    ulong off, start_sector, end_sector, num_sectors;
    ulong start_sector_offset, total_sector_size;
	void *tmp_buf;
    const char *err_oper = NULL;
    int ret;

    if (!dfd->spi)
        return -ENODEV;

    spi = spi_flash_probe(CONFIG_SF_DEFAULT_BUS, CONFIG_SF_DEFAULT_CS,
            CONFIG_SF_DEFAULT_SPEED, CONFIG_SF_DEFAULT_MODE);
    if (!spi)
        return -ENODEV;

    if (offset + size > spi->size) {
        printf("Error: write beyond flash end (0x%lx + 0x%zx > 0x%lx)\n",
            offset, size, (ulong)spi->size);
        return -ENOSPC;
    }

    off = offset % spi->sector_size; /* 扇区内偏移（单位：字节） */
	start_sector = offset / spi->sector_size; /* 起始扇区 */
	end_sector = (offset + size - 1) / spi->sector_size; /* 结束扇区 */
	num_sectors = end_sector - start_sector + 1; /* 需要读取、擦除与写入的扇区数 */
    start_sector_offset = start_sector * spi->sector_size; /* 起始扇区偏移量（单位：字节） */
    total_sector_size = num_sectors * spi->sector_size; /* 需要操作的扇区的总大小（单位：字节） */

    tmp_buf = memalign(ARCH_DMA_MINALIGN, total_sector_size);
    if (!tmp_buf) {
        printf("Error: Cannot allocate %lu bytes\n", total_sector_size);
        return -ENOMEM;
    }

    /* 读取 */
    ret = spi_flash_read(spi, start_sector_offset, total_sector_size, tmp_buf);
    if (ret) {
        err_oper = "read";
        goto error_operation;
    }

    /* 修改 */
    memcpy(tmp_buf + off, buf, size);

    /* 擦除 */
    ret = spi_flash_erase(spi, start_sector_offset, total_sector_size);
    if (ret) {
        err_oper = "erase";
        goto error_operation;
    }

    /* 写回 */
    ret = spi_flash_write(spi, start_sector_offset, total_sector_size, tmp_buf);
    if (ret) {
        err_oper = "write";
        goto error_operation;
    }

    free(tmp_buf);

    return 0;

error_operation:
    printf("Error: failed to %s %lu bytes starting at offset 0x%lx\n",
        err_oper, total_sector_size, start_sector_offset);
    free(tmp_buf);
    return -EIO;
}

int write_data_to_nand(ulong offset, size_t size, const void *buf)
{
    nand_info_t *nand = &nand_info[CONFIG_NAND_FLASH_INFO_IDX];
    nand_erase_options_t opts;
    ulong off, start_block, end_block, num_blocks;
    ulong start_block_offset, total_block_size;
    size_t readsize, writesize;
    void *tmp_buf;
    const char *err_oper = NULL;
    int ret;

    if (!dfd->nand)
        return -ENODEV;

    if (offset + size > nand->size) {
        printf("Error: write beyond flash end (0x%lx + 0x%zx > 0x%lx)\n",
            offset, size, (ulong)nand->size);
        return -ENOSPC;
    }

    off = offset % nand->erasesize; /* 块内偏移（单位：字节） */
	start_block = offset / nand->erasesize; /* 起始块 */
	end_block = (offset + size - 1) / nand->erasesize; /* 结束块 */
	num_blocks = end_block - start_block + 1; /* 需要读取、擦除与写入的块数 */
    start_block_offset = start_block * nand->erasesize; /* 起始块偏移量（单位：字节） */
    total_block_size = num_blocks * nand->erasesize; /* 需要操作的块的总大小（单位：字节） */
    readsize = total_block_size;
    writesize = total_block_size;

    tmp_buf = memalign(ARCH_DMA_MINALIGN, total_block_size);
    if (!tmp_buf) {
        printf("Error: Cannot allocate %lu bytes\n", total_block_size);
        return -ENOMEM;
    }

    /* 读取 */
    ret = nand_read_skip_bad(nand, start_block_offset, &readsize,
            NULL, total_block_size, (u_char *)tmp_buf);
    if (ret) {
        err_oper = "read";
        goto error_operation;
    }

    /* 修改 */
    memcpy(tmp_buf + off, buf, size);

    /* 擦除 */
    memset(&opts, 0, sizeof(opts));
    opts.offset = start_block_offset;
    opts.length = total_block_size;
    opts.quiet = 1;
    ret = nand_erase_opts(nand, &opts);
    if (ret) {
        err_oper = "erase";
        goto error_operation;
    }

    /* 写回 */
    ret = nand_write_skip_bad(nand, start_block_offset, &writesize,
            NULL, total_block_size, (u_char *)tmp_buf, WITH_WR_VERIFY);
    if (ret) {
        err_oper = "write";
        goto error_operation;
    }

    free(tmp_buf);

    return 0;

error_operation:
    printf("Error: failed to %s %lu bytes starting at offset 0x%lx\n",
        err_oper, total_block_size, start_block_offset);
    free(tmp_buf);
    return -EIO;
}

int write_data_to_mmc(u64 offset, size_t size, const void *buf)
{
    struct mmc *mmc;
    block_dev_desc_t *bd;
    ulong off, start_block, end_block;
	ulong readblks, writeblks, num_blocks;
	void *tmp_buf;

    if (!dfd->mmc)
        return -ENODEV;

    mmc = find_mmc_device(mmc_host.dev_num);
    if (!mmc)
        return -ENODEV;

    if (offset + size > mmc->capacity_user) {
        printf("Error: write beyond flash end (0x%llx + 0x%zx > 0x%llx)\n",
            offset, size, mmc->capacity_user);
        return -ENOSPC;
    }

    bd = &mmc->block_dev;

    off = offset % bd->blksz; /* 块内偏移（单位：字节） */
	start_block = offset / bd->blksz; /* 起始块 */
	end_block = (offset + size - 1) / bd->blksz; /* 结束块 */
	num_blocks = end_block - start_block + 1; /* 需要读取与写入的块数 */

    tmp_buf = memalign(ARCH_DMA_MINALIGN, num_blocks * bd->blksz);
    if (!tmp_buf) {
        printf("Error: Cannot allocate %lu bytes\n", num_blocks * bd->blksz);
        return -ENOMEM;
    }

    /* 读取 */
    readblks = bd->block_read(mmc_host.dev_num, start_block, num_blocks, tmp_buf);
    if (readblks != num_blocks) {
        printf("Error: failed to read %lu blocks (%lu blocks read actually)\n",
            num_blocks, readblks);
        free(tmp_buf);
        return -EIO;
    }

    /* 修改 */
    memcpy(tmp_buf + off, buf, size);

    /* 写回 */
    writeblks = bd->block_write(mmc_host.dev_num, start_block, num_blocks, tmp_buf);
    if (writeblks != num_blocks) {
        printf("Error: failed to write %lu blocks (%lu blocks written actually)\n",
            num_blocks, writeblks);
        free(tmp_buf);
        return -EIO;
    }

    free(tmp_buf);

    return 0;
}
