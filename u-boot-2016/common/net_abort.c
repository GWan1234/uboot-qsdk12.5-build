// SPDX-License-Identifier: GPL-2.0
/*
 * Copyright (C) 2026 chenxin527. All Rights Reserved.
 *
 * This file is part of the project uboot-qsdk12.5-build
 *
 * Network abort detection for U-Boot autoboot
 */

#include <common.h>
#include <console.h>
#include <cli.h>
#include <ipq_api.h>

#define ABORT_PORT			37541
#define ABORT_REPLY_PORT	37540
#define ABORT_MAGIC			"UBOOT:ABORT"
#define ABORT_REPLY_MAGIC	"UBOOT:ABORTED"

static bool net_abort_pkt_received = false;

/* Check if received UDP packet is our abort magic packet */
static void net_abort_udp_handler(uchar *pkt, unsigned dport,
			      struct in_addr sip, unsigned sport,
			      unsigned len)
{
	/* Only check packets sent to our abort port */
	if (dport != ABORT_PORT)
		return;

	/* Check packet content */
	if (len == strlen(ABORT_MAGIC) &&
		memcmp(pkt, ABORT_MAGIC, strlen(ABORT_MAGIC)) == 0) {
		net_abort_pkt_received = true;
	}
}

/* Timeout handler - called periodically during polling */
static void net_abort_timeout_handler(void)
{
	/* Nothing needed here, just re-arm the timeout for next cycle */
	net_set_timeout_handler(100, net_abort_timeout_handler);
}

bool net_abort_detected(void)
{
	return net_abort_pkt_received;
}

bool net_abort_prepare(void)
{
	ulong ts;
	int ret, counter = 3;;
	bool abort = false;

	net_abort_pkt_received = false;

	if (getenv("disable_net_abort"))
		return false;

	printf("WAIT PHY LINK TO SETTLE DOWN: %-2d", counter);
	while (!abort && counter > 0) {
		counter--;
		ts = get_timer(0);
		do {
			if (tstc()) { /* we got a key press	*/
				abort = true;
				counter = 0;
				(void) getc(); /* consume input	*/
				break;;
			}

			udelay(10000);
		} while (!abort && get_timer(ts) < 1000);

		printf("\b\b%-2d", counter);
	}

	putc('\n');

	ret = eth_init();
	for (int i = 3; i > 0 && ret < 0; i--) {
		ts = get_timer(0);
		do {
			if (ctrlc()) {
				eth_halt();
				return false;
			}
			udelay(10000);
		} while (get_timer(ts) < 1000);
		ret = eth_init();
	}

	if (ret < 0) {
		eth_halt();
		return false;
	}

	net_init();
	/* Set our UDP handler to detect abort packets */
	net_set_udp_handler(net_abort_udp_handler);
	/* Set timeout handler for periodic checking */
	net_set_timeout_handler(100, net_abort_timeout_handler);

	return true;
}

void net_abort_reply(void)
{
	uchar *pkt;
	struct in_addr broadcast_ip;

	/* Send reply to confirm we received the abort */
	broadcast_ip.s_addr = 0xFFFFFFFF; /* 255.255.255.255 */
	pkt = net_tx_packet + net_eth_hdr_size() + IP_UDP_HDR_SIZE;

	memcpy(pkt, ABORT_REPLY_MAGIC, strlen(ABORT_REPLY_MAGIC));

	net_send_udp_packet(
		(uchar *)net_bcast_ethaddr,  /* use broadcast MAC */
		broadcast_ip,
		ABORT_REPLY_PORT,    /* destination port */
		ABORT_REPLY_PORT,    /* source port */
		strlen(ABORT_REPLY_MAGIC));
}

void net_abort_finish(void)
{
	net_set_udp_handler(NULL);
	net_set_timeout_handler(0, NULL);

	if (net_abort_pkt_received) {
		net_abort_reply();
		puts("Net abort packet received, enter web failsafe mode\n");
		run_command("httpd", 0);
		cli_loop();
	}
}
