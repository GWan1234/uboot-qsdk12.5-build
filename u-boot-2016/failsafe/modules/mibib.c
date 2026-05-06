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
#include <spi.h>
#include <spi_flash.h>
#include <nand.h>
#include <asm/arch-qca-common/smem.h>
#include <net/httpd.h>
#include <failsafe/fw.h>
#include <ipq_api.h>

#include "mibib.h"

void mibib_reload_handler(enum httpd_uri_handler_status status,
        struct httpd_request *request,
        struct httpd_response *response)
{
    static char resp[256];
    qca_smem_flash_info_t *sfi = &qca_smem_flash_info;
    detected_flash_device_t *dfd = &detected_flash_device;
    struct spi_flash *spi;
    nand_info_t *nand;
    struct httpd_form_value *mibib;
    uint32_t page_size;
    int fw_type, ret;

    if (status != HTTP_CB_NEW)
        return;

    response->status = HTTP_RESP_STD;
	response->info.code = 200;
	response->info.connection_close = 1;
	response->info.content_type = "application/json";

    if (!is_9008_mode) {
        handle_fail_led_state();
        response->data = "{\"status\":\"fail\","
                        "\"info\":{\"type\":\"not_in_9008_mode\"}}";
        response->size = strlen(response->data);
        return;
    }

    mibib = httpd_request_find_value(request, "mibib");

    if (!mibib || !mibib->data) {
        handle_fail_led_state();
        response->data = "{\"status\":\"fail\","
                        "\"info\":{\"type\":\"no_mibib_file\"}}";
        response->size = strlen(response->data);
        return;
    }

    fw_type = check_fw_type(mibib->data);
    switch (fw_type) {
    case FW_TYPE_MIBIB_NAND:
        if (!dfd->nand)
			goto flash_not_found;
        nand = &nand_info[CONFIG_NAND_FLASH_INFO_IDX];
        page_size = 2048;
#ifdef CONFIG_QPIC_SERIAL
		sfi->flash_type = SMEM_BOOT_QSPI_NAND_FLASH;
#else
		sfi->flash_type = SMEM_BOOT_NAND_FLASH;
#endif
        sfi->flash_block_size = nand->erasesize;
        sfi->flash_density = nand->size;
        break;
    case FW_TYPE_MIBIB_NOR:
        if (!dfd->spi)
			goto flash_not_found;
        spi = spi_flash_probe(CONFIG_SF_DEFAULT_BUS, CONFIG_SF_DEFAULT_CS,
                    CONFIG_SF_DEFAULT_SPEED, CONFIG_SF_DEFAULT_MODE);
        page_size = 256;
        sfi->flash_type = SMEM_BOOT_SPI_FLASH;
        sfi->flash_block_size = spi->erase_size;
        sfi->flash_density = spi->size;
        break;
    default:
        handle_fail_led_state();
        snprintf(resp, sizeof(resp),
            "{\"status\":\"fail\",\"info\":{\"type\":\"wrong_file_type\","
            "\"expected\":\"MIBIB\",\"actual\":\"%s\"}}", fw_type_to_string(fw_type));
        response->data = resp;
        response->size = strlen(response->data);
        return;
    }

    ret = mibib_ptable_init((unsigned int *)(mibib->data + page_size));
    if (ret) {
        handle_fail_led_state();
        response->data = "{\"status\":\"fail\","
                        "\"info\":{\"type\":\"invalid_table_magic\"}}";
        response->size = strlen(response->data);
        return;
    }

    handle_success_led_state();
    get_kernel_fs_part_details();

    response->data = "{\"status\":\"success\"}";
    response->size = strlen(response->data);

    return;

flash_not_found:
    handle_fail_led_state();
	snprintf(resp, sizeof(resp),
		"{\"status\":\"fail\",\"info\":{\"type\":\"flash_not_found\","
        "\"filetype\":\"%s\",\"flashtype\":\"%s\"}}",
		fw_type_to_string(fw_type),
        (fw_type == FW_TYPE_MIBIB_NOR) ? "SPI-NOR" : "NAND");
    response->data = resp;
    response->size = strlen(response->data);
    return;
}
