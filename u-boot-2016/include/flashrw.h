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

#ifndef __FLASHRW_H__
#define __FLASHRW_H__

int read_data_from_spi(ulong offset, size_t size, void *buf, size_t buf_size);
int read_data_from_nand(ulong offset, size_t size, void *buf, size_t buf_size);
int read_data_from_mmc(u64 offset, size_t size, void *buf, size_t buf_size);
int write_data_to_spi(ulong offset, size_t size, const void *buf);
int write_data_to_nand(ulong offset, size_t size, const void *buf);
int write_data_to_mmc(u64 offset, size_t size, const void *buf);

#endif /* __FLASHRW_H__ */
