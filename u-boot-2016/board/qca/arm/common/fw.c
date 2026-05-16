#include <common.h>
#include <failsafe/fw.h>

/**
 * check_fw_type - 检查文件类型
 * @address: 文件地址
 *
 * 通过检查魔数来判断文件类型.
 *
 * 如果文件类型未知，则返回 FW_TYPE_UNKNOWN；否则返回具体文件类型。
 */
int check_fw_type(const void *address) {
	u32 *header_magic1 = (u32 *)(address);
	u32 *header_magic2 = (u32 *)(address + 0x4);

	switch (*header_magic1) {
	case HEADER_MAGIC_CDT:
		return FW_TYPE_CDT;
	case HEADER_MAGIC_ELF:
		if (*((u64 *)(address + 0xC0000)) == HEADER_MAGIC_MBN)
			return FW_TYPE_NOR;
		else
			return FW_TYPE_ELF;
	case HEADER_MAGIC_FIT:
		if (*((u32 *)(address + 0x5C)) == HEADER_MAGIC_QSDK)
			return FW_TYPE_QSDK;
		else if (*((u32 *)(address + 0x600000)) == HEADER_MAGIC_SQUASHFS)
			return FW_TYPE_FACTORY_KERNEL6M;
		else if (*((u32 *)(address + 0xC00000)) == HEADER_MAGIC_SQUASHFS)
			return FW_TYPE_FACTORY_KERNEL12M;
		else
			return FW_TYPE_FIT;
	case HEADER_MAGIC_LEGACY_IMAGE:
		if (*((u32 *)(address + 0x40)) == HEADER_MAGIC_ASUSWRT_EMMC)
			return FW_TYPE_ASUSWRT_EMMC;
		else
			return FW_TYPE_LEGACY_IMAGE;
	case HEADER_MAGIC_MBN1:
		if (*header_magic2 == HEADER_MAGIC_MBN2) {
			if (*((u64 *)(address + 0x100)) == HEADER_MAGIC_PTABLE)
				return FW_TYPE_MIBIB_NOR;
			else if (*((u64 *)(address + 0x800)) == HEADER_MAGIC_PTABLE)
				return FW_TYPE_MIBIB_NAND;
		}
		return FW_TYPE_UNKNOWN;
	case HEADER_MAGIC_SBL_NAND1:
		if (*header_magic2 == HEADER_MAGIC_SBL_NAND2)
			return FW_TYPE_NAND;
		return FW_TYPE_UNKNOWN;
	case HEADER_MAGIC_SYSUPGRADE1:
		if (*header_magic2 == HEADER_MAGIC_SYSUPGRADE2)
			return FW_TYPE_SYSUPGRADE;
		return FW_TYPE_UNKNOWN;
	case HEADER_MAGIC_UBI:
		return FW_TYPE_UBI;
	default:
		if (*((u16 *)(address + 0x1FE)) == HEADER_MAGIC_EMMC)
			return FW_TYPE_EMMC;
		else
			return FW_TYPE_UNKNOWN;
	}
}

char *fw_type_to_string(const int fw_type) {
	switch (fw_type) {
	case FW_TYPE_ASUSWRT_EMMC:
		return "ASUSWRT";
	case FW_TYPE_CDT:
		return "CDT";
	case FW_TYPE_ELF:
		return "ELF";
	case FW_TYPE_EMMC:
		return "GPT (Single Image for eMMC device)";
	case FW_TYPE_FACTORY_KERNEL6M:
		return "Factory Firmware (Kernel Size: 6MiB)";
	case FW_TYPE_FACTORY_KERNEL12M:
		return "Factory Firmware (Kernel Size: 12MiB)";
	case FW_TYPE_LEGACY_IMAGE:
		return "Legacy Image";
	case FW_TYPE_FIT:
		return "FIT Image";
	case FW_TYPE_QSDK:
		return "JDCloud Official Firmware";
	case FW_TYPE_MIBIB_NAND:
		return "MIBIB for NAND device";
	case FW_TYPE_MIBIB_NOR:
		return "MIBIB for SPI-NOR device";
	case FW_TYPE_NAND:
		return "Single Image for NAND device";
	case FW_TYPE_NOR:
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
