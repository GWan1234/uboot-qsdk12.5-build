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

#include <common.h>
#include <net/httpd.h>

#include "network.h"

# if defined(CONFIG_IPADDR)
static const char *default_ipaddr = __stringify(CONFIG_IPADDR);
# else
static const char *default_ipaddr = "192.168.1.1";
# endif /* CONFIG_IPADDR */
# if defined(CONFIG_NETMASK)
static const char *default_netmask = __stringify(CONFIG_NETMASK);
# else
static const char *default_netmask = "255.255.255.0";
# endif /* CONFIG_NETMASK */
# if defined(CONFIG_SERVERIP)
static const char *default_serverip = __stringify(CONFIG_SERVERIP);
# else
static const char *default_serverip = "192.168.1.2";
# endif /* CONFIG_SERVERIP */

static void handle_response_message(struct httpd_response *response,
		int code, const char *msg, const char *content_type)
{
	response->status = HTTP_RESP_STD;
	response->data = msg ? msg : "";
	response->size = strlen(response->data);
	response->info.code = code;
	response->info.connection_close = 1;
	response->info.content_type = content_type ? content_type : "text/plain";
}

static void network_set_env(struct httpd_response *response, bool custom,
		const char *ipaddr, const char *netmask, const char *serverip)
{
	int modified = 0;
	bool custom_state_changed = false;
	const char *custom_state = getenv("custom_network");

	if ((custom && !custom_state) || (!custom && custom_state))
		custom_state_changed = true;

	if (custom_state_changed)
		if(!setenv("custom_network", custom ? "1" : NULL))
			modified++;

	if (strcmp(getenv("ipaddr"), ipaddr))
		if(!setenv("ipaddr", ipaddr))
			modified++;

	if (strcmp(getenv("netmask"), netmask))
		if(!setenv("netmask", netmask))
			modified++;

	if (strcmp(getenv("serverip"), serverip))
		if(!setenv("serverip", serverip))
			modified++;

	if (modified)
		if(saveenv())
			handle_response_message(response, 500, "save failed", NULL);

	handle_response_message(response, 200, "ok", NULL);
}

void network_info_handler(enum httpd_uri_handler_status status,
	    struct httpd_request *request,
	    struct httpd_response *response)
{
	static char resp[128];
	const char *ipaddr, *netmask, *serverip;

	if (status != HTTP_CB_NEW)
		return;

	if (!request || request->method != HTTP_GET) {
		handle_response_message(response, 405, "method", NULL);
		return;
	}

	ipaddr = getenv("ipaddr");
	netmask = getenv("netmask");
	serverip = getenv("serverip");

	snprintf(resp, sizeof(resp),
		"{\"ipaddr\":\"%s\",\"netmask\":\"%s\",\"serverip\":\"%s\"}",
		ipaddr ? ipaddr : default_ipaddr,
		netmask ? netmask : default_netmask,
		serverip ? serverip : default_serverip);

	handle_response_message(response, 200, resp, "application/json");
}

void network_set_handler(enum httpd_uri_handler_status status,
	    struct httpd_request *request,
	    struct httpd_response *response)
{
	struct httpd_form_value *ipaddr, *netmask, *serverip;

	if (status != HTTP_CB_NEW)
		return;

	if (!request || request->method != HTTP_POST) {
		handle_response_message(response, 405, "method", NULL);
		return;
	}

	ipaddr = httpd_request_find_value(request, "ipaddr");
	netmask = httpd_request_find_value(request, "netmask");
	serverip = httpd_request_find_value(request, "serverip");

	if (!ipaddr || !ipaddr->data ||
		!netmask || !netmask->data ||
		!serverip || !serverip->data) {
		handle_response_message(response, 400, "empty field", NULL);
		return;
	}

	network_set_env(response, true,
		ipaddr->data, netmask->data, serverip->data);
}

void network_reset_handler(enum httpd_uri_handler_status status,
	    struct httpd_request *request,
	    struct httpd_response *response)
{
	if (status != HTTP_CB_NEW)
		return;

	if (!request || request->method != HTTP_POST) {
		handle_response_message(response, 405, "method", NULL);
		return;
	}

	network_set_env(response, false,
		default_ipaddr, default_netmask, default_serverip);
}
