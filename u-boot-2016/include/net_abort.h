// SPDX-License-Identifier: GPL-2.0
/*
 * Copyright (C) 2026 chenxin527. All Rights Reserved.
 *
 * This file is part of the project uboot-qsdk12.5-build
 *
 * Network abort detection for U-Boot autoboot
 */

#ifndef _NET_ABORT_H_
#define _NET_ABORT_H_

bool net_abort_prepare(void);
bool net_abort_detected(void);
void net_abort_reply(void);
void net_abort_finish(void);

#endif /* _NET_ABORT_H_ */
