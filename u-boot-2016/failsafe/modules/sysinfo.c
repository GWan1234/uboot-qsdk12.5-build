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
#include <linux/ctype.h>
#include <asm/arch-qca-common/smem.h>
#include <part.h>
#include <linux/mtd/mtd.h>
#include <nand.h>
#include <mmc.h>
#include <sdhci.h>
#include <spi.h>
#include <spi_flash.h>
#include <malloc.h>
#include <errno.h>
#include <version.h>
#include <net/httpd.h>
#include <ipq_api.h>

#ifndef CONFIG_SDHCI_SUPPORT
extern qca_mmc mmc_host;
#else
extern struct sdhci_host mmc_host;
#endif

DECLARE_GLOBAL_DATA_PTR;

#define GPT_PART_NAME "0:GPT"
#define GPT_SIZE_IN_BLOCKS 34

#define SMEM_PTN_NAME_MAX     16
#define SMEM_PTABLE_PARTS_MAX 32

static const qca_smem_flash_info_t *sfi = &qca_smem_flash_info;
static const detected_flash_device_t *dfd = &detected_flash_device;

struct smem_ptn {
	char name[SMEM_PTN_NAME_MAX];
	unsigned start;
	unsigned size;
	unsigned attr;
} __attribute__ ((__packed__));

struct smem_ptable {
	unsigned magic[2];
	unsigned version;
	unsigned len;
	struct smem_ptn parts[SMEM_PTABLE_PARTS_MAX];
} __attribute__ ((__packed__));

static void handle_response_message(struct httpd_response *response,
    int code, const char *data, const char *content_type)
{
	response->status = HTTP_RESP_STD;
	response->data = data ? data : "";
	response->size = strlen(response->data);
	response->info.code = code;
	response->info.connection_close = 1;
	response->info.content_type = content_type ? content_type : "text/plain";
}

void sysinfo_handler(enum httpd_uri_handler_status status,
        struct httpd_request *request,
        struct httpd_response *response)
{
	char *buf;
	int len = 0;
	int left = 16666;
	struct mmc *mmc;
	const struct smem_ptable *spt;
	block_dev_desc_t *bd = NULL;
    const char *board_hostname = NULL;
    const char *board_model = NULL;
    const char *board_compat = NULL;
    char esc_board_hostname[128], esc_board_model[128], esc_board_compat[128];
    char esc_version_string[256];

	if (status == HTTP_CB_CLOSED && response->session_data) {
		free(response->session_data);
		response->session_data = NULL;
		return;
	}

	if (status != HTTP_CB_NEW)
		return;

	response->session_data = NULL;

	buf = malloc(left);
	if (!buf) {
		handle_response_message(response, 500, "no mem", NULL);
		return;
	}

	len += snprintf(buf + len, left - len, "{");

    len += snprintf(buf + len, left - len,
        "\"is_9008_mode\":%s,", is_9008_mode() ? "true" : "false");

    json_escape(version_string, esc_version_string, sizeof(esc_version_string));
    len += snprintf(buf + len, left - len, "\"uboot_version\":\"%s\",", esc_version_string);

    /* Board info */
    board_hostname = fdt_getprop(gd->fdt_blob, 0, "host_name", NULL);
    board_model = fdt_getprop(gd->fdt_blob, 0, "model", NULL);
    board_compat = fdt_getprop(gd->fdt_blob, 0, "compatible", NULL);

    json_escape(board_hostname, esc_board_hostname, sizeof(esc_board_hostname));
    json_escape(board_model, esc_board_model, sizeof(esc_board_model));
    json_escape(board_compat, esc_board_compat, sizeof(esc_board_compat));

	len += snprintf(buf + len, left - len, "\"board\":{");
	len += snprintf(buf + len, left - len, "\"hostname\":\"%s\",", esc_board_hostname);
	len += snprintf(buf + len, left - len, "\"model\":\"%s\",", esc_board_model);
	len += snprintf(buf + len, left - len, "\"compatible\":\"%s\",", esc_board_compat);
	len += snprintf(buf + len, left - len, "\"machid\":\"0x%lx\",", (ulong)gd->bd->bi_arch_number);
	len += snprintf(buf + len, left - len, "\"ram_size\":%lu", (ulong)gd->ram_size);
	len += snprintf(buf + len, left - len, "},"); /* board */

    /* SMEM info */
	len += snprintf(buf + len, left - len, "\"smeminfo\": {");

    len += snprintf(buf + len, left - len, "\"flash_type\":\"%s\",",
        flash_type_to_string(sfi->flash_type));

    len += snprintf(buf + len, left - len,
        "\"flash_block_size\":%lu,", (ulong)sfi->flash_block_size);

    len += snprintf(buf + len, left - len,
        "\"flash_density\":%lu,", (ulong)sfi->flash_density);

    len += snprintf(buf + len, left - len, "\"flash_secondary_type\":\"%s\"",
        flash_type_to_string(sfi->flash_secondary_type));

	len += snprintf(buf + len, left - len, "},"); /* smeminfo */

	/* Flash devices info */
	len += snprintf(buf + len, left - len, "\"devices\":{");

	/* SPI info */
	len += snprintf(buf + len, left - len, "\"spi\":{");
	len += snprintf(buf + len, left - len, "\"present\":%s", dfd->spi ? "true" : "false");
	if (dfd->spi) {
		struct spi_flash *spi;
		spi = spi_flash_probe(CONFIG_SF_DEFAULT_BUS, CONFIG_SF_DEFAULT_CS,
					CONFIG_SF_DEFAULT_SPEED, CONFIG_SF_DEFAULT_MODE);
		len += snprintf(buf + len, left - len,
			",\"name\":\"%s\",\"size\":%lu,"
            "\"page_size\":%lu,\"sector_size\":%lu,\"erase_size\":%lu",
            spi->name, (ulong)spi->size,
            (ulong)spi->page_size, (ulong)spi->sector_size, (ulong)spi->erase_size);
	}
	len += snprintf(buf + len, left - len, "},"); /* devices: spi */

	/* MMC info */
	len += snprintf(buf + len, left - len, "\"mmc\":{");
	len += snprintf(buf + len, left - len, "\"present\":%s", dfd->mmc ? "true" : "false");
	if (dfd->mmc) {
        int major_ver, minor_ver, change_ver;

		mmc = find_mmc_device(mmc_host.dev_num);
		bd = mmc_get_dev(mmc_host.dev_num);

        major_ver = EXTRACT_SDMMC_MAJOR_VERSION(mmc->version);
        minor_ver = EXTRACT_SDMMC_MINOR_VERSION(mmc->version);
        change_ver = EXTRACT_SDMMC_CHANGE_VERSION(mmc->version);

		len += snprintf(buf + len, left - len,
			",\"vendor\":\"%s\",\"product\":\"%s\","
            "\"size\":%llu,\"block_size\":%lu,"
            "\"version\":\"%d.%d",
			bd->vendor, bd->product,
            (unsigned long long)mmc->capacity_user, bd->blksz,
            major_ver, minor_ver);

        if (change_ver)
            len += snprintf(buf + len, left - len, ".%d\"", change_ver);
        else
            len += snprintf(buf + len, left - len, "\"");
	}
	len += snprintf(buf + len, left - len, "},"); /* devices: mmc */

	/* NAND info */
	len += snprintf(buf + len, left - len, "\"nand\":{");
	len += snprintf(buf + len, left - len, "\"present\":%s", dfd->nand ? "true" : "false");
	if (dfd->nand) {
		nand_info_t *nand = &nand_info[CONFIG_NAND_FLASH_INFO_IDX];
		len += snprintf(buf + len, left - len,
			",\"name\":\"%s\",\"size\":%llu,"
            "\"page_size\":%lu,\"block_size\":%lu,\"oob_size\":%lu,"
            "\"oob_avail\":%lu,\"ecc_step_size\":%u,\"ecc_strength\":%u",
            nand->name, (unsigned long long)nand->size,
            (ulong)nand->writesize, (ulong)nand->erasesize, (ulong)nand->oobsize,
            (ulong)nand->oobavail, nand->ecc_step_size, nand->ecc_strength);
	}
	len += snprintf(buf + len, left - len, "}"); /* devices: nand */
	len += snprintf(buf + len, left - len, "},"); /* devices */


	/* Partitions */
	len += snprintf(buf + len, left - len, "\"partitions\":{");

	/* SMEM partitions */
	spt = get_smem_ptable_addr();

	len += snprintf(buf + len, left - len, "\"smem\":{");
	len += snprintf(buf + len, left - len, "\"present\":%s,", spt->len ? "true" : "false");
	len += snprintf(buf + len, left - len, "\"parts\":[");

	for (int i = 0; i < spt->len; i++) {
		const struct smem_ptn *p = &spt->parts[i];
		uint32_t offset_in_bytes = 0, size_in_bytes = 0;

		getpart_offset_size((char *)p->name, &offset_in_bytes, &size_in_bytes);

		len += snprintf(buf + len, left - len,
			"%s{\"name\":\"%s\",\"start\":%lu,\"size\":%lu}",
			i ? "," : "", p->name, (ulong)offset_in_bytes, (ulong)size_in_bytes);
	}

	len += snprintf(buf + len, left - len, "]"); /* partitions: smem: parts */
	len += snprintf(buf + len, left - len, "},"); /* partitions: smem */

	/* MMC partitions */
	len += snprintf(buf + len, left - len, "\"mmc\":{");
	len += snprintf(buf + len, left - len, "\"present\":%s,", dfd->mmc ? "true" : "false");
	len += snprintf(buf + len, left - len, "\"parts\":[");

	if (dfd->mmc) {
		disk_partition_t dpart = {0};
		int idx = 1;

		len += snprintf(buf + len, left - len,
			"{\"name\":\"0:GPT\",\"start\":0,\"size\":%lu}", GPT_SIZE_IN_BLOCKS * bd->blksz);

		while (len < left - 128) {
			if (get_partition_info_efi(bd, idx, &dpart))
				break;

			if (!dpart.name[0]) {
				idx++;
				continue;
			}

			len += snprintf(buf + len, left - len,
				",{\"name\":\"%s\",\"start\":%llu,\"size\":%llu}",
				dpart.name, (unsigned long long)dpart.start * dpart.blksz,
                (unsigned long long)dpart.size * dpart.blksz);

			idx++;
		}
	}

	len += snprintf(buf + len, left - len, "]"); /* partitions: mmc: parts */
	len += snprintf(buf + len, left - len, "}"); /* partitions: mmc */
	len += snprintf(buf + len, left - len, "}"); /* partitions */

	len += snprintf(buf + len, left - len, "}");

	handle_response_message(response, 200, buf, "application/json");
	response->session_data = buf;
}
