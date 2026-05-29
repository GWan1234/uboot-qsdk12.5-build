// SPDX-License-Identifier: GPL-2.0
/*
 * Copyright (C) 2026 chenxin527. All Rights Reserved.
 *
 * This file is part of the project uboot-qsdk12.5-build
 *
 * Failsafe MAC address management
 */

#ifndef _FAILSAFE_MAC_H_
#define _FAILSAFE_MAC_H_

void mac_info_handler(enum httpd_uri_handler_status status,
	    struct httpd_request *request,
	    struct httpd_response *response);
void mac_set_handler(enum httpd_uri_handler_status status,
	    struct httpd_request *request,
	    struct httpd_response *response);

#endif /* _FAILSAFE_MAC_H_ */
