/* SPDX-License-Identifier: GPL-2.0 */
/*
 * Copyright (C) 2026 Yuzhii0718
 *
 * All rights reserved.
 *
 * Minimal telnet server for MediaTek web failsafe.
 */

#ifndef __NET_TELNETD_H__
#define __NET_TELNETD_H__

#include <stdbool.h>

/**
 * telnetd_start() - Start the telnet server on a given port
 *
 * @port: TCP port number (host byte order)
 * Return: 0 on success, negative on error
 */
int telnetd_start(u16 port);

/**
 * telnetd_stop() - Stop the telnet server
 */
void telnetd_stop(void);
bool telnetd_is_running(void);

#endif /* __NET_TELNETD_H__ */
