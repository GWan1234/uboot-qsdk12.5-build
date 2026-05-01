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

/*
 * Modified by: chenxin527
 */

#ifndef _FAILSAFE_SYSINFO_H_
#define _FAILSAFE_SYSINFO_H_

void sysinfo_handler(enum httpd_uri_handler_status status,
        struct httpd_request *request,
        struct httpd_response *response);

#endif /* _FAILSAFE_SYSINFO_H_ */
