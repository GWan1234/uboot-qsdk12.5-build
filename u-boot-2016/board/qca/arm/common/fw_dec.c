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
#include <ipq_api.h>
#include <failsafe/fw_dec.h>

#define U16_DATA_AT_OFFSET(n) (*((const u16 *)(n)))
#define U32_DATA_AT_OFFSET(n) (*((const u32 *)(n)))
#define U64_DATA_AT_OFFSET(n) (*((const u64 *)(n)))

fw_type_t check_fw_type(uintptr_t addr, size_t size)
{
	switch (U32_DATA_AT_OFFSET(addr)) {
	case HEADER_MAGIC_CDT:
		return FW_TYPE_CDT;
	case HEADER_MAGIC_ELF:
		if (get_mibib_ptable_offset((const void *)addr,
				size, MIBIB_TYPE_NOR) != NULL)
			return FW_TYPE_SIMG_NOR;
		return FW_TYPE_ELF;
	case HEADER_MAGIC_FIT:
		if (U32_DATA_AT_OFFSET(addr + 0x5C) == HEADER_MAGIC_QSDK) {
			switch (U32_DATA_AT_OFFSET(addr + 0x65)) {
			case HEADER_MAGIC_GLINET_V3: return FW_TYPE_GLINET_V3;
			case HEADER_MAGIC_GLINET_V4: return FW_TYPE_GLINET_V4;
			case HEADER_MAGIC_JDCLOUD: return FW_TYPE_JDCLOUD;
			default: return FW_TYPE_FIT;
			}
		}
		return FW_TYPE_FIT;
	case HEADER_MAGIC_LEGACY_IMAGE:
		if (U32_DATA_AT_OFFSET(addr + 0x40) == HEADER_MAGIC_ASUSWRT_EMMC)
			return FW_TYPE_ASUSWRT_EMMC;
		return FW_TYPE_LEGACY_IMAGE;
	case HEADER_MAGIC_MBN1:
		if (U32_DATA_AT_OFFSET(addr + 0x4) == HEADER_MAGIC_MBN2) {
			if (U64_DATA_AT_OFFSET(addr + 0x100) == HEADER_MAGIC_PTABLE)
				return FW_TYPE_MIBIB_NOR;
			if (U64_DATA_AT_OFFSET(addr + 0x800) == HEADER_MAGIC_PTABLE)
				return FW_TYPE_MIBIB_NAND;
		}
		return FW_TYPE_UNKNOWN;
	case HEADER_MAGIC_SBL_NAND1:
		if (U32_DATA_AT_OFFSET(addr + 0x4) == HEADER_MAGIC_SBL_NAND2)
			return FW_TYPE_SIMG_NAND;
		return FW_TYPE_UNKNOWN;
	case HEADER_MAGIC_SYSUPGRADE1:
		if (U32_DATA_AT_OFFSET(addr + 0x4) == HEADER_MAGIC_SYSUPGRADE2)
			return FW_TYPE_SYSUPGRADE;
		return FW_TYPE_UNKNOWN;
	case HEADER_MAGIC_UBI:
		return FW_TYPE_UBI;
	default:
		if (U16_DATA_AT_OFFSET(addr + 0x1FE) == HEADER_MAGIC_GPT)
			return FW_TYPE_GPT;
		return FW_TYPE_UNKNOWN;
	}
}

char *fw_type_to_string(fw_type_t fw_type)
{
	switch (fw_type) {
	case FW_TYPE_ASUSWRT_EMMC:
		return "ASUSWRT";
	case FW_TYPE_CDT:
		return "CDT";
	case FW_TYPE_ELF:
		return "ELF";
	case FW_TYPE_LEGACY_IMAGE:
		return "Legacy Image";
	case FW_TYPE_FIT:
		return "FIT Image";
	case FW_TYPE_GLINET_V3:
		return "GLiNet Official Firmware (Version: 3.x)";
	case FW_TYPE_GLINET_V4:
		return "GLiNet Official Firmware (Version: 4.x)";
	case FW_TYPE_GPT:
		return "GPT (Single Image for eMMC device)";
	case FW_TYPE_JDCLOUD:
		return "JDCloud Official Firmware";
	case FW_TYPE_MIBIB_NAND:
		return "MIBIB for NAND device";
	case FW_TYPE_MIBIB_NOR:
		return "MIBIB for SPI-NOR device";
	case FW_TYPE_SIMG_NAND:
		return "Single Image for NAND device";
	case FW_TYPE_SIMG_NOR:
		return "Single Image for SPI-NOR device";
	case FW_TYPE_SYSUPGRADE:
		return "Sysupgrade Firmware";
	case FW_TYPE_UBI:
		return "UBI Firmware";
	case FW_TYPE_UNKNOWN:
	default:
		return "Unknown";
	}
}
