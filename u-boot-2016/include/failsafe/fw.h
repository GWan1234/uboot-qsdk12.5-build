#ifndef __FW_H__
#define __FW_H__

enum {
    FW_TYPE_UNKNOWN = -1,
    FW_TYPE_CDT,                /* CDT 文件 */
    FW_TYPE_ELF,                /* ELF 文件*/
    FW_TYPE_EMMC,               /* eMMC 的 GPT 分区表或镜像，只要开头有 GPT 信息即可 */
    FW_TYPE_FACTORY_KERNEL6M,   /* Factory 格式的固件 (Kernel 大小: 6MB) */
    FW_TYPE_FACTORY_KERNEL12M,  /* Factory 格式的固件 (Kernel 大小: 12MB) */
    FW_TYPE_FIT,                /* FIT Image，包括 Factory Image 和 FIT Initramfs uImage */
    FW_TYPE_MIBIB_NAND,         /* NAND 的 MIBIB 分区表 */
    FW_TYPE_MIBIB_NOR,          /* SPI-NOR 的 MIBIB 分区表 */
    FW_TYPE_NAND,               /* NAND 的镜像，只需以 SBL1 开头即可 */
    FW_TYPE_NOR,                /* SPI-NOR 的镜像，至少包含 SBL1 和 MIBIB */
    FW_TYPE_QSDK,               /* QSDK 固件，目前仅支持京东云官方固件 */
    FW_TYPE_SYSUPGRADE,         /* Sysupgrade Tar 格式的固件 */
    FW_TYPE_UBI,                /* UBI 固件（针对 NAND 机型） */
};

/*
 * MIBIB for SPI-NOR or NAND FLASH
 * MBN Header Magic: AC 9F 56 FE 7A 12 7F CD
 * Partition Table offset for SPI-NOR: 0x100, for NAND: 0x800.
 * Partition Table Header Magic: AA 73 EE 55 DB BD 5E E3
 */
#define HEADER_MAGIC_MBN1        0xFE569FAC
#define HEADER_MAGIC_MBN2        0xCD7F127A
#define HEADER_MAGIC_MBN         0xCD7F127AFE569FAC
#define HEADER_MAGIC_PTABLE      0xE35EBDDB55EE73AA

/*
 * For NAND IMAGE, only check SBL1 Header: D1 DC 4B 84 34 10 D7 73
 */
#define HEADER_MAGIC_SBL_NAND1   0x844BDCD1
#define HEADER_MAGIC_SBL_NAND2   0x73D71034

#define HEADER_MAGIC_CDT         0x00544443
#define HEADER_MAGIC_ELF         0x464C457F
#define HEADER_MAGIC_EMMC        0xAA55
#define HEADER_MAGIC_FIT         0xEDFE0DD0
#define HEADER_MAGIC_QSDK        0x73616C46
#define HEADER_MAGIC_SQUASHFS    0x73717368
#define HEADER_MAGIC_SYSUPGRADE1 0x75737973
#define HEADER_MAGIC_SYSUPGRADE2 0x61726770
#define HEADER_MAGIC_UBI         0x23494255

int check_fw_type(const void *address);
char *fw_type_to_string(const int fw_type);

#endif /* __FW_H__ */
