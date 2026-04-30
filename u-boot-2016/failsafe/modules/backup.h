/* SPDX-License-Identifier: GPL-2.0 */
/*
 * Copyright (C) 2026 Yuzhii0718
 *
 * All rights reserved.
 *
 * This file is part of the project bl-mt798x-dhcpd
 * You may not use, copy, modify or distribute this file except in compliance with the license agreement.
 *
 * Failsafe flash backup
 */

#ifndef __FAILSAFE_BACKUP_H__
#define __FAILSAFE_BACKUP_H__

void backupinfo_handler(enum httpd_uri_handler_status status,
        struct httpd_request *request,
        struct httpd_response *response);
void backup_handler(enum httpd_uri_handler_status status,
        struct httpd_request *request,
        struct httpd_response *response);

#endif /* __FAILSAFE_BACKUP_H__ */
