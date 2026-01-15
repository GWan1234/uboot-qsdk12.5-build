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

void print_fw_type(const int fw_type) {
	switch (fw_type) {
	case FW_TYPE_CDT:
		printf("CDT");
		break;
	case FW_TYPE_ELF:
		printf("ELF");
		break;
	case FW_TYPE_EMMC:
		printf("EMMC IMAGE");
		break;
	case FW_TYPE_FACTORY_KERNEL6M:
		printf("FACTORY FIRMWARE (KERNEL SIZE: 6MB)");
		break;
	case FW_TYPE_FACTORY_KERNEL12M:
		printf("FACTORY FIRMWARE (KERNEL SIZE: 12MB)");
		break;
	case FW_TYPE_FIT:
		printf("FIT IMAGE");
		break;
	case FW_TYPE_QSDK:
		printf("JDCLOUD OFFICIAL FIRMWARE");
		break;
	case FW_TYPE_MIBIB_NAND:
		printf("MIBIB for NAND device");
		break;
	case FW_TYPE_MIBIB_NOR:
		printf("MIBIB for SPI-NOR device");
		break;
	case FW_TYPE_NAND:
		printf("NAND IMAGE");
		break;
	case FW_TYPE_NOR:
		printf("SPI-NOR IMGAGE");
		break;
	case FW_TYPE_SYSUPGRADE:
		printf("SYSUPGRADE FIRMWARE");
		break;
	case FW_TYPE_UBI:
		printf("UBI FIRMWARE");
		break;
	case FW_TYPE_UNKNOWN:
	default:
		printf("UNKNOWN");
	}
}
