#ifndef __FW_H__
#define __FW_H__

typedef enum {
    FW_TYPE_UNKNOWN = -1,
    FW_TYPE_ASUSWRT_EMMC,       /* 华硕固件（eMMC 机型） */
    FW_TYPE_CDT,                /* CDT 文件 */
    FW_TYPE_ELF,                /* ELF 文件*/
    FW_TYPE_FIT,                /* FIT Image */
    FW_TYPE_GLINET_V3,          /* GLiNet 官方固件（版本：3.x） */
    FW_TYPE_GLINET_V4,          /* GLiNet 官方固件（版本：4.x） */
    FW_TYPE_GPT,                /* eMMC 的 GPT 分区表 */
    FW_TYPE_JDCLOUD,            /* 京东云官方固件 */
    FW_TYPE_LEGACY_IMAGE,       /* Legacy Image */
    FW_TYPE_MIBIB_NAND,         /* NAND 的 MIBIB 分区表 */
    FW_TYPE_MIBIB_NOR,          /* SPI-NOR 的 MIBIB 分区表 */
    FW_TYPE_SIMG_NAND,          /* NAND 的闪存镜像，只需以 SBL1 开头即可 */
    FW_TYPE_SIMG_NOR,           /* SPI-NOR 的闪存镜像，至少包含 SBL1 和 MIBIB */
    FW_TYPE_SYSUPGRADE,         /* Sysupgrade Tar 格式的固件 */
    FW_TYPE_UBI,                /* UBI 固件（针对 NAND 机型） */
} fw_type_t;

#define FW_TYPE_SIMG_EMMC FW_TYPE_GPT /* eMMC 的闪存镜像，只需以 GPT 开头即可 */

/*
 * MIBIB for SPI-NOR or NAND FLASH
 * MBN Header Magic: AC 9F 56 FE 7A 12 7F CD
 * Partition Table offset for SPI-NOR: 0x100, for NAND: 0x800.
 * Partition Table Header Magic: AA 73 EE 55 DB BD 5E E3
 */
#define HEADER_MAGIC_MBN1        0xFE569FAC
#define HEADER_MAGIC_MBN2        0xCD7F127A
#define HEADER_MAGIC_MBN         0xCD7F127AFE569FAC
#define FOOTER_MAGIC_MBN         0xF1DED2EA9D41BEA1
#define HEADER_MAGIC_PTABLE      0xE35EBDDB55EE73AA

#define PTABLE_START_IN_MIBIB_NAND   0x800
#define PTABLE_END_IN_MIBIB_NAND     0x1800
#define PTABLE_START_IN_MIBIB_NOR    0x100
#define PTABLE_END_IN_MIBIB_NOR      0x900

/*
 * For NAND IMAGE, only check SBL1 Header: D1 DC 4B 84 34 10 D7 73
 */
#define HEADER_MAGIC_SBL_NAND1   0x844BDCD1
#define HEADER_MAGIC_SBL_NAND2   0x73D71034

#define HEADER_MAGIC_ASUSWRT_EMMC  0x67616D69
#define HEADER_MAGIC_CDT           0x00544443
#define HEADER_MAGIC_ELF           0x464C457F
#define HEADER_MAGIC_FIT           0xEDFE0DD0
#define HEADER_MAGIC_GPT           0xAA55
#define HEADER_MAGIC_LEGACY_IMAGE  0x56190527
#define HEADER_MAGIC_SQUASHFS      0x73717368
#define HEADER_MAGIC_SYSUPGRADE1   0x75737973
#define HEADER_MAGIC_SYSUPGRADE2   0x61726770
#define HEADER_MAGIC_UBI           0x23494255

#define HEADER_MAGIC_QSDK          0x73616C46
#define HEADER_MAGIC_GLINET_V3     0x646E616E
#define HEADER_MAGIC_GLINET_V4     0x74636166
#define HEADER_MAGIC_JDCLOUD       0x636D6D65

fw_type_t check_fw_type(uintptr_t addr);
char *fw_type_to_string(fw_type_t fw_type);

#endif /* __FW_H__ */
