/*
 * YARA Rules Bundle — NO ENTRY SOC Platform
 * Covers: LockBit 3.0, Cl0p Ransomware, BlackCat/ALPHV, Cobalt Strike,
 *         AsyncRAT, Log4Shell exploitation, and generic crypto-miner detection.
 * Source: Adapted from open-source community rules (public domain / CC0).
 */

rule LockBit3_Ransomware {
    meta:
        description = "Detects LockBit 3.0 (LockBit Black) ransomware indicators"
        author = "NO ENTRY SOC Platform"
        date = "2024-01-15"
        severity = "critical"
        reference = "https://www.cisa.gov/news-events/cybersecurity-advisories/aa23-075a"
        mitre_attack = "T1486"
        tags = "ransomware,lockbit"
    strings:
        $ransom_note  = "LockBit" ascii wide nocase
        $ext1         = ".lockbit" ascii nocase
        $ext2         = ".HLjkNskOq" ascii
        $api1         = "CryptEncrypt" ascii
        $api2         = "GetVolumeInformationW" ascii
        $mutex        = "Global\\{" ascii
        $pdb          = "lockbit" ascii wide nocase
    condition:
        uint16(0) == 0x5A4D and 2 of ($ransom_note, $ext1, $ext2, $pdb) and 1 of ($api1, $api2, $mutex)
}

rule Cl0p_Ransomware {
    meta:
        description = "Detects Cl0p ransomware family indicators"
        author = "NO ENTRY SOC Platform"
        date = "2024-01-15"
        severity = "critical"
        reference = "https://www.cisa.gov/news-events/cybersecurity-advisories/aa23-158a"
        mitre_attack = "T1486"
        tags = "ransomware,clop"
    strings:
        $clop1        = "Cl0p" ascii wide nocase
        $clop2        = "ClopReadMe.txt" ascii nocase
        $ext          = ".clop" ascii nocase
        $ransom       = "YOUR DATA WILL BE PUBLISHED" ascii wide nocase
        $api_shadow   = "vssadmin delete shadows" ascii nocase
        $wiper_cmd    = "bcdedit /set {default} recoveryenabled No" ascii nocase
    condition:
        uint16(0) == 0x5A4D and (2 of ($clop1, $clop2, $ext, $ransom) or all of ($api_shadow, $wiper_cmd))
}

rule BlackCat_ALPHV_Ransomware {
    meta:
        description = "Detects BlackCat/ALPHV ransomware (Rust-based)"
        author = "NO ENTRY SOC Platform"
        date = "2024-01-15"
        severity = "critical"
        reference = "https://www.cisa.gov/news-events/cybersecurity-advisories/aa22-264a"
        mitre_attack = "T1486"
        tags = "ransomware,blackcat,alphv"
    strings:
        $rust_sig     = "ALPHV" ascii wide nocase
        $ransom_note  = "RECOVER-" ascii
        $ext1         = ".alphv" ascii nocase
        $ext2         = ".blackcat" ascii nocase
        $config_key   = "extension" ascii
        $rust_panic   = "panicked at" ascii
        $rop_chain    = { 48 8B 05 ?? ?? ?? ?? 48 85 C0 74 ?? FF D0 }
    condition:
        uint16(0) == 0x5A4D and ($rust_sig or ($ransom_note and 1 of ($ext1, $ext2)) or ($config_key and $rust_panic))
}

rule CobaltStrike_Beacon_Memory {
    meta:
        description = "Detects Cobalt Strike beacon in-memory artifacts"
        author = "NO ENTRY SOC Platform"
        date = "2024-01-15"
        severity = "high"
        reference = "https://www.cobaltstrike.com/"
        mitre_attack = "T1071.001"
        tags = "c2,cobalt_strike,apt"
    strings:
        $s1 = "%s (admin)" wide
        $s2 = "beacon.x64.dll" ascii
        $s3 = "ReflectiveDll" ascii
        $s4 = "cdn.jquery" ascii nocase
        $s5 = { 68 6F 73 74 6E 61 6D 65 00 }  // "hostname" null-terminated
        $watermark = { 00 00 00 00 00 00 00 00 ?? ?? ?? ?? 00 00 00 00 }
        $pipe = "\\\\.\\pipe\\" ascii
    condition:
        (2 of ($s1, $s2, $s3, $s4)) or ($watermark and $pipe and $s4)
}

rule AsyncRAT_Trojan {
    meta:
        description = "Detects AsyncRAT remote access trojan"
        author = "NO ENTRY SOC Platform"
        date = "2024-01-15"
        severity = "high"
        reference = "https://github.com/NYAN-x-CAT/AsyncRAT-C-Sharp"
        mitre_attack = "T1219"
        tags = "rat,asyncrat,trojan"
    strings:
        $rat1  = "AsyncRAT" ascii wide nocase
        $rat2  = "Client.Helper.Methods" ascii
        $rat3  = "AntiVM" ascii
        $rat4  = "AntiAnalysis" ascii
        $mutex = "AsyncMutex_" ascii wide
        $cert  = "OU=AsyncRAT Server" ascii
        $cmd   = "cmd.exe /c" ascii
    condition:
        uint16(0) == 0x5A4D and (2 of ($rat1, $rat2, $rat3, $rat4, $mutex, $cert))
}

rule Log4Shell_Exploitation_Pattern {
    meta:
        description = "Detects Log4Shell (CVE-2021-44228) exploitation attempt artifacts"
        author = "NO ENTRY SOC Platform"
        date = "2024-01-15"
        severity = "critical"
        reference = "https://nvd.nist.gov/vuln/detail/CVE-2021-44228"
        mitre_attack = "T1190"
        tags = "log4j,log4shell,rce,cve-2021-44228"
    strings:
        $jndi1 = "${jndi:ldap://" ascii nocase
        $jndi2 = "${jndi:rmi://" ascii nocase
        $jndi3 = "${jndi:dns://" ascii nocase
        $jndi4 = "${jndi:corba://" ascii nocase
        $obf1  = "${${::-j}${::-n}${::-d}${::-i}" ascii nocase
        $obf2  = "${${lower:j}ndi" ascii nocase
        $obf3  = "j$%7Bn%7Ddi" ascii nocase
    condition:
        any of them
}

rule Generic_CryptoMiner {
    meta:
        description = "Detects generic cryptocurrency miner indicators (XMRig, etc.)"
        author = "NO ENTRY SOC Platform"
        date = "2024-01-15"
        severity = "medium"
        reference = "https://attack.mitre.org/techniques/T1496/"
        mitre_attack = "T1496"
        tags = "cryptominer,xmrig,monero"
    strings:
        $s1   = "stratum+tcp://" ascii nocase
        $s2   = "stratum+ssl://" ascii nocase
        $s3   = "xmrig" ascii wide nocase
        $s4   = "MoneroOcean" ascii nocase
        $s5   = "donate.v2.xmrig" ascii nocase
        $cpu1 = "--max-cpu-usage" ascii nocase
        $cpu2 = "--threads" ascii nocase
        $pool = "pool.minexmr.com" ascii nocase
    condition:
        2 of ($s1, $s2, $s3, $s4, $s5, $pool) or all of ($cpu1, $cpu2)
}
