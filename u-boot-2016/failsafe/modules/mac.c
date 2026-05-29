// SPDX-License-Identifier: GPL-2.0
/*
 * Copyright (C) 2026 chenxin527. All Rights Reserved.
 *
 * This file is part of the project uboot-qsdk12.5-build
 *
 * Failsafe MAC address management
 */

#include <common.h>
#include <errno.h>
#include <malloc.h>
#include <part.h>
#include <linux/mtd/mtd.h>
#include <nand.h>
#include <mmc.h>
#include <sdhci.h>
#include <spi.h>
#include <spi_flash.h>
#include <net/httpd.h>
#include <ipq_api.h>
#include <flashrw.h>

#include "mac.h"

#ifndef CONFIG_SDHCI_SUPPORT
extern qca_mmc mmc_host;
#else
extern struct sdhci_host mmc_host;
#endif

#if defined(CONFIG_MAC_TYPE_RAW_HEX)
#define MAC_LEN_BYTES 6
#else
#define MAC_LEN_BYTES 17
#endif

struct mac_entry {
#if defined(CONFIG_MAC_TYPE_RAW_HEX)
	uchar data[MAC_LEN_BYTES];
#else
	char data[MAC_LEN_BYTES + 1];
#endif
};

typedef struct mac_entry mac_entry_t;

struct mac_info {
	mac_entry_t macs[CONFIG_MAC_COUNT];
} __attribute__ ((__packed__));

typedef struct mac_info mac_info_t;

enum {
	READ_MAC_DATA,
	WRITE_MAC_DATA
};

static qca_smem_flash_info_t *sfi = &qca_smem_flash_info;
static detected_flash_device_t *dfd = &detected_flash_device;

static void handle_response_message(struct httpd_response *response,
		int code, const char *msg, const char *content_type)
{
	response->status = HTTP_RESP_STD;
	response->data = msg ? msg : "";
	response->size = strlen(response->data);
	response->info.code = code;
	response->info.connection_close = 1;
	response->info.content_type = content_type ? content_type : "text/plain";
}

static int get_mac_part_offset_size(uint32_t *part_offset, uint32_t *part_size)
{
	block_dev_desc_t *mmc_dev;
	disk_partition_t disk_info = {0};
	int ret;

	switch (sfi->flash_type) {
	case SMEM_BOOT_NAND_FLASH:
	case SMEM_BOOT_NOR_FLASH:
	case SMEM_BOOT_NORPLUSEMMC:
	case SMEM_BOOT_NORPLUSNAND:
	case SMEM_BOOT_ONENAND_FLASH:
	case SMEM_BOOT_QSPI_NAND_FLASH:
	case SMEM_BOOT_SPI_FLASH:
		ret = getpart_offset_size(CONFIG_MAC_PART_NAME, part_offset, part_size);
		if (ret)
			return -ENOENT;
		break;
	case SMEM_BOOT_MMC_FLASH:
	case SMEM_BOOT_NO_FLASH:
	case SMEM_BOOT_SDC_FLASH:
		if (!dfd->mmc)
			return -ENODEV;
		mmc_dev = mmc_get_dev(mmc_host.dev_num);
		if (!mmc_dev)
			return -ENODEV;
		ret = get_partition_info_efi_by_name(mmc_dev, CONFIG_MAC_PART_NAME, &disk_info);
		if (ret)
			return -ENOENT;
		*part_offset = disk_info.start * disk_info.blksz;
		*part_size = disk_info.size * disk_info.blksz;
		break;
	default:
		puts("Unsupported flash type\n");
		return -EINVAL;
	}

	return 0;
}

static int get_mac_data_offset_size(uint32_t *mac_data_offset,
		uint32_t *mac_data_size, struct httpd_response *response)
{
	uint32_t mac_part_offset, mac_part_size;
	int ret;

	ret = get_mac_part_offset_size(&mac_part_offset, &mac_part_size);
	if (ret) {
		handle_response_message(response, 500, "mac part not found", NULL);
		return -1;
	}

#if defined(CONFIG_MAC_TYPE_RAW_HEX)
	*mac_data_offset = mac_part_offset + CONFIG_MAC_OFFSET_IN_PART;
	*mac_data_size = CONFIG_MAC_COUNT * MAC_LEN_BYTES;
#else /* CONFIG_MAC_TYPE_RAW_HEX */
	void *buf;
	const void *p;
	const char *label_str = CONFIG_MAC_LABEL;
	ulong size_remain, label_len;

	/* ASCII 类 MAC，目前只支持数量为 1 */
	if (CONFIG_MAC_COUNT != 1) {
		handle_response_message(response, 500, "wrong mac count", NULL);
		return -1;
	}

	buf = malloc(mac_part_size);
	if (!buf) {
		handle_response_message(response, 500, "no mem", NULL);
		return -1;
	}

	switch (sfi->flash_type) {
	case SMEM_BOOT_NOR_FLASH:
	case SMEM_BOOT_NORPLUSEMMC:
	case SMEM_BOOT_NORPLUSNAND:
	case SMEM_BOOT_SPI_FLASH:
		ret = read_data_from_spi(mac_part_offset, mac_part_size, buf, mac_part_size);
		break;
	case SMEM_BOOT_NAND_FLASH:
	case SMEM_BOOT_ONENAND_FLASH:
	case SMEM_BOOT_QSPI_NAND_FLASH:
		ret = read_data_from_nand(mac_part_offset, mac_part_size, buf, mac_part_size);
		break;
	case SMEM_BOOT_MMC_FLASH:
	case SMEM_BOOT_NO_FLASH:
	case SMEM_BOOT_SDC_FLASH:
		ret = read_data_from_mmc(mac_part_offset, mac_part_size, buf, mac_part_size);
		break;
	default:
		handle_response_message(response, 500, "wrong flash type", NULL);
		free(buf);
		return -1;
	}

	if (ret) {
		handle_response_message(response, 500, "failed to read mac part", NULL);
		free(buf);
		return -1;
	}

	p = buf;
	size_remain = mac_part_size;
	label_len = strlen(label_str);

	while (size_remain >= label_len) {
		size_remain--;
		if (!memcmp(p, label_str, label_len) &&
			*((char *)(p + label_len + 1 + MAC_LEN_BYTES)) == '\n') {
			*mac_data_offset = mac_part_offset + (p - buf) + (label_len + 1);
			break;
		}
		p++;
	}

	free(buf);

	if (size_remain < label_len) {
		handle_response_message(response, 500, "mac not found", NULL);
		return -1;
	}

	*mac_data_size = CONFIG_MAC_COUNT * MAC_LEN_BYTES;
#endif /* CONFIG_MAC_TYPE_RAW_HEX */

	return 0;
}

static int read_write_mac_data(int operation, mac_info_t *mac_info, struct httpd_response *response)
{
	uint32_t mac_data_offset, mac_data_size;
	int ret;

	if (operation != READ_MAC_DATA && operation != WRITE_MAC_DATA) {
		handle_response_message(response, 500, "wrong operation", NULL);
		return -1;
	}

	ret = get_mac_data_offset_size(&mac_data_offset, &mac_data_size, response);
	if (ret)
		return -1;

	switch (sfi->flash_type) {
	case SMEM_BOOT_NOR_FLASH:
	case SMEM_BOOT_NORPLUSEMMC:
	case SMEM_BOOT_NORPLUSNAND:
	case SMEM_BOOT_SPI_FLASH:
		if (operation == READ_MAC_DATA)
			ret = read_data_from_spi(mac_data_offset, mac_data_size, &mac_info->macs, mac_data_size);
		else
			ret = write_data_to_spi(mac_data_offset, mac_data_size, &mac_info->macs);
		break;
	case SMEM_BOOT_NAND_FLASH:
	case SMEM_BOOT_ONENAND_FLASH:
	case SMEM_BOOT_QSPI_NAND_FLASH:
		if (operation == READ_MAC_DATA)
			ret = read_data_from_nand(mac_data_offset, mac_data_size, &mac_info->macs, mac_data_size);
		else
			ret = write_data_to_nand(mac_data_offset, mac_data_size, &mac_info->macs);
		break;
	case SMEM_BOOT_MMC_FLASH:
	case SMEM_BOOT_NO_FLASH:
	case SMEM_BOOT_SDC_FLASH:
		if (operation == READ_MAC_DATA)
			ret = read_data_from_mmc(mac_data_offset, mac_data_size, &mac_info->macs, mac_data_size);
		else
			ret = write_data_to_mmc(mac_data_offset, mac_data_size, &mac_info->macs);
		break;
	default:
		handle_response_message(response, 500, "wrong flash type", NULL);
		return -1;
	}

	if (ret)
		handle_response_message(response, 500,
			operation == READ_MAC_DATA ? "failed to read mac data" : "failed to write mac data", NULL);

	return ret;
}

#if defined(CONFIG_MAC_TYPE_RAW_HEX)
static int hex_char_to_int(char ch)
{
	if (ch >= '0' && ch <= '9')
		return ch - '0';
	else if (ch >= 'a' && ch <= 'f')
		return ch - 'a' + 10;
	else if (ch >= 'A' && ch <= 'F')
		return ch - 'A' + 10;
	else
		return -1;
}

static int parse_mac_byte(char *byte, uchar *mac_byte)
{
	char ch[2];
	int len = strlen(byte);
	int integer;

	switch (len) {
	case 1:
		ch[0] = '0';
		ch[1] = byte[0];
		break;
	case 2:
		ch[0] = byte[0];
		ch[1] = byte[1];
		break;
	default:
		puts("Wrong MAC format\n");
		return -1;
	}

	integer = hex_char_to_int(ch[0]);
	if (integer < 0) {
		puts("Not hex char\n");
		return -1;
	}
	*mac_byte = (integer << 4) & 0xF0;

	integer = hex_char_to_int(ch[1]);
	if (integer < 0) {
		puts("Not hex char\n");
		return -1;
	}
	*mac_byte += integer & 0xF;

	return 0;
}

static int parse_mac_entry(char *entry, mac_entry_t *mac_entry)
{
	char *byte = entry;
	char *next_byte;
	int ret = 0, num = 0;

	while (byte && *byte) {
		num++;

		next_byte = strchr(byte, ':');
		if (!next_byte) {
			ret = parse_mac_byte(byte, &mac_entry->data[num - 1]);
			break;
		}

		*next_byte = '\0';

		ret = parse_mac_byte(byte, &mac_entry->data[num - 1]);
		if (ret)
			break;

		byte = next_byte + 1;
	}

	if (num != MAC_LEN_BYTES) {
		printf("Wrong MAC length (expect: %d, actual: %d)\n", MAC_LEN_BYTES, num);
		return -1;
	}

	return ret;
}

static int parse_mac_list(char *list, mac_info_t *mac_info)
{
	char *entry = list;
	char *next_entry;
	int ret = 0, num = 0;

	while (entry && *entry) {
		num++;

		next_entry = strchr(entry, ';');
		if (!next_entry) {
			ret = parse_mac_entry(entry, &mac_info->macs[num - 1]);
			break;
		}

		*next_entry = '\0';

		ret = parse_mac_entry(entry, &mac_info->macs[num - 1]);
		if (ret)
			break;

		entry = next_entry + 1;
	}

	if (num != CONFIG_MAC_COUNT) {
		printf("Wrong MAC count (expect: %d, actual: %d)\n", CONFIG_MAC_COUNT, num);
		return -1;
	}

	return ret;
}

#else /* CONFIG_MAC_TYPE_RAW_HEX */

static bool hex_char_to_uppercase(char in, char *out)
{
	if ((in >= '0' && in <= '9') || (in >= 'A' && in <= 'F')) {
		*out = in;
		return true;
	} else if (in >= 'a' && in <= 'f') {
		*out = in - 'a' + 'A';
		return true;
	} else {
		return false;
	}
}

static int parse_mac_byte(char *byte, char *mac_byte, int *idx)
{
	int len = strlen(byte);
	char ch;

	switch (len) {
	case 1:
		mac_byte[(*idx)++] = '0';
		if (!hex_char_to_uppercase(byte[0], &ch)) {
			puts("Not hex char\n");
			return -1;
		}
		mac_byte[(*idx)++] = ch;
		break;
	case 2:
		if (!hex_char_to_uppercase(byte[0], &ch)) {
			puts("Not hex char\n");
			return -1;
		}
		mac_byte[(*idx)++] = ch;
		if (!hex_char_to_uppercase(byte[1], &ch)) {
			puts("Not hex char\n");
			return -1;
		}
		mac_byte[(*idx)++] = ch;
		break;
	default:
		puts("Wrong MAC format\n");
		return -1;
	}

	return 0;
}

static int parse_mac_ascii(char *mac_str, mac_info_t *mac_info)
{
	char *byte = mac_str;
	char *next_byte;
	char *data = mac_info->macs[0].data;
	int ret = 0, idx = 0;

	while (byte && *byte) {
		next_byte = strchr(byte, ':');
		if (!next_byte) {
			ret = parse_mac_byte(byte, data, &idx);
			break;
		}

		*next_byte = '\0';

		ret = parse_mac_byte(byte, data, &idx);
		data[idx++] = ':';
		if (ret)
			break;

		byte = next_byte + 1;
	}

	data[idx] = '\0';

	if (idx != MAC_LEN_BYTES) {
		printf("Wrong MAC length (expect: %d, actual: %d)\n", MAC_LEN_BYTES, idx);
		return -1;
	}

	return ret;
}
#endif /* CONFIG_MAC_TYPE_RAW_HEX */

void mac_info_handler(enum httpd_uri_handler_status status,
	    struct httpd_request *request,
	    struct httpd_response *response)
{
	char *buf;
	int len = 0;
	int left = 1024;
	mac_info_t mac_info;

	if (status == HTTP_CB_CLOSED && response->session_data) {
		free(response->session_data);
		response->session_data = NULL;
		return;
	}

	if (status != HTTP_CB_NEW)
		return;

	response->session_data = NULL;

	if (!request || request->method != HTTP_GET) {
		handle_response_message(response, 405, "bad method", NULL);
		return;
	}

	memset(&mac_info, 0, sizeof(mac_info));
	if (read_write_mac_data(READ_MAC_DATA, &mac_info, response))
		return;

	buf = malloc(left);
	if (!buf) {
		handle_response_message(response, 500, "no mem", NULL);
		return;
	}

	len += snprintf(buf + len, left - len, "{");
	len += snprintf(buf + len, left - len, "\"part_name\":\"%s\",", CONFIG_MAC_PART_NAME);
	len += snprintf(buf + len, left - len, "\"macs\":[");

	for (int i = 0; i < CONFIG_MAC_COUNT; i++) {
		len += snprintf(buf + len, left - len, "%s\"", i ? "," : "");
#if defined(CONFIG_MAC_TYPE_RAW_HEX)
		for (int j = 0; j < MAC_LEN_BYTES; j++) {
			len += snprintf(buf + len, left - len, "%s%02X",
				j ? ":" : "", mac_info.macs[i].data[j]);
		}
#else
		len += snprintf(buf + len, left - len, "%s", mac_info.macs[i].data);
#endif
		len += snprintf(buf + len, left - len, "\"");
	}

	len += snprintf(buf + len, left - len, "]");
	len += snprintf(buf + len, left - len, "}");

	handle_response_message(response, 200, buf, "application/json");
	response->session_data = buf;
}

void mac_set_handler(enum httpd_uri_handler_status status,
	    struct httpd_request *request,
	    struct httpd_response *response)
{
	struct httpd_form_value *mac_data;
	mac_info_t mac_info;
	int ret;

	if (status != HTTP_CB_NEW)
		return;

	mac_data = httpd_request_find_value(request, "mac_data");

	if (!mac_data || !mac_data->data || !mac_data->data[0]) {
		handle_response_message(response, 400, "no mac", NULL);
		return;
	}

	memset(&mac_info, 0, sizeof(mac_info));

#if defined(CONFIG_MAC_TYPE_RAW_HEX)
	ret = parse_mac_list((char *)mac_data->data, &mac_info);
#else
	ret = parse_mac_ascii((char *)mac_data->data, &mac_info);
#endif

	if (ret) {
		handle_response_message(response, 400, "invalid mac", NULL);
		return;
	}

	if (read_write_mac_data(WRITE_MAC_DATA, &mac_info, response))
		return;

	handle_response_message(response, 200, "ok", NULL);
}
