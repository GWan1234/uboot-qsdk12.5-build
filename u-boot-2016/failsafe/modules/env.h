/* SPDX-License-Identifier: GPL-2.0 */
/*
 * Copyright (C) 2026 Yuzhii0718
 *
 * All rights reserved.
 *
 * This file is part of the project bl-mt798x-dhcpd
 * You may not use, copy, modify or distribute this file except in compliance with the license agreement.
 *
 * Failsafe environment management
 */

#ifndef _FAILSAFE_ENV_H_
#define _FAILSAFE_ENV_H_

void env_list_handler(enum httpd_uri_handler_status status,
	    struct httpd_request *request,
	    struct httpd_response *response);
void env_set_handler(enum httpd_uri_handler_status status,
	    struct httpd_request *request,
	    struct httpd_response *response);
void env_unset_handler(enum httpd_uri_handler_status status,
	    struct httpd_request *request,
	    struct httpd_response *response);
void env_reset_handler(enum httpd_uri_handler_status status,
	    struct httpd_request *request,
	    struct httpd_response *response);
void env_restore_handler(enum httpd_uri_handler_status status,
	    struct httpd_request *request,
	    struct httpd_response *response);

#endif /* _FAILSAFE_ENV_H_ */
