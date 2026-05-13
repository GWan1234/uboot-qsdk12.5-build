enum acl_action {
    ACL_ALLOW = 0,
    ACL_DENY  = 1,
};

enum acl_rule_id {
    ACL_RULE_DHCP_TO_SERVER  = 0,
    ACL_RULE_DHCP_TO_CLIENT  = 1,
    ACL_RULE_NET_ABORT       = 2,
    ACL_RULE_TFTP_TO_US      = 3,
    ACL_RULE_UDP_DENY_ALL    = 10,
};

extern void ipq6018_ppe_acl_set(int rule_id, int rule_type, int pkt_type,
        int l4_port_no, int l4_port_mask, enum acl_action action);
