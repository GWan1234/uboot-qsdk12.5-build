// SPDX-License-Identifier:	GPL-2.0
/*
 * Copyright (C) 2019 MediaTek Inc. All Rights Reserved.
 *
 * Author: Weijie Gao <weijie.gao@mediatek.com>
 *
 */

#ifndef _FAILSAFE_FS_H_
#define _FAILSAFE_FS_H_

struct fs_desc {
    const char *path;                /* HTTP文件路径，用于查找 */
    const void *data;                /* 文件数据（可能gzip压缩） */
    unsigned int size;               /* 文件数据大小 */
    unsigned int uncompressed_size;  /* 未压缩的文件数据大小（若数据未使用gzip压缩，则该值与size相等）*/
    int is_gzip;                     /* 数据是否为gzip压缩格式 */
    const char *content_type;        /* MIME类型 */
};

const struct fs_desc *fs_find_file(const char *path);

#endif /* _FAILSAFE_FS_H_ */
