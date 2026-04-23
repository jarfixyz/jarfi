/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/jarfi_contract.json`.
 */
export type JarfiContract = {
  "address": "HtQt8P4pcF2X4D9oxWwsafj5KnwJsUPF148mvkZMQaFW",
  "metadata": {
    "name": "jarfiContract",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "approveQuest",
      "discriminator": [
        167,
        10,
        79,
        180,
        30,
        164,
        195,
        1
      ],
      "accounts": [
        {
          "name": "jar",
          "writable": true
        },
        {
          "name": "quest",
          "writable": true
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "jar"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "createJar",
      "discriminator": [
        79,
        12,
        25,
        249,
        245,
        177,
        203,
        232
      ],
      "accounts": [
        {
          "name": "jar",
          "writable": true,
          "signer": true
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "mode",
          "type": "u8"
        },
        {
          "name": "unlockDate",
          "type": "i64"
        },
        {
          "name": "goalAmount",
          "type": "u64"
        },
        {
          "name": "childWallet",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "createQuest",
      "discriminator": [
        112,
        49,
        32,
        224,
        255,
        173,
        5,
        7
      ],
      "accounts": [
        {
          "name": "jar",
          "writable": true
        },
        {
          "name": "quest",
          "writable": true,
          "signer": true
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "jar"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "frequency",
          "type": "u8"
        }
      ]
    },
    {
      "name": "deposit",
      "discriminator": [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
      ],
      "accounts": [
        {
          "name": "jar",
          "writable": true
        },
        {
          "name": "depositor",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "emergencyWithdraw",
      "discriminator": [
        239,
        45,
        203,
        64,
        150,
        73,
        218,
        92
      ],
      "accounts": [
        {
          "name": "jar",
          "writable": true
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "jar"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "giftDeposit",
      "discriminator": [
        207,
        40,
        25,
        141,
        187,
        180,
        124,
        189
      ],
      "accounts": [
        {
          "name": "jar",
          "writable": true
        },
        {
          "name": "contribution",
          "writable": true,
          "signer": true
        },
        {
          "name": "contributor",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "comment",
          "type": "string"
        }
      ]
    },
    {
      "name": "setSpendingLimit",
      "discriminator": [
        39,
        48,
        237,
        161,
        49,
        171,
        155,
        208
      ],
      "accounts": [
        {
          "name": "jar",
          "writable": true
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "jar"
          ]
        }
      ],
      "args": [
        {
          "name": "dailyLimit",
          "type": "u64"
        },
        {
          "name": "weeklyLimit",
          "type": "u64"
        }
      ]
    },
    {
      "name": "unlockJar",
      "discriminator": [
        117,
        66,
        52,
        254,
        109,
        7,
        243,
        22
      ],
      "accounts": [
        {
          "name": "jar",
          "writable": true
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "jar"
          ]
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "contribution",
      "discriminator": [
        182,
        187,
        14,
        111,
        72,
        167,
        242,
        212
      ]
    },
    {
      "name": "jar",
      "discriminator": [
        197,
        50,
        234,
        142,
        247,
        216,
        114,
        137
      ]
    },
    {
      "name": "quest",
      "discriminator": [
        68,
        78,
        51,
        23,
        204,
        27,
        76,
        132
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "questNameTooLong",
      "msg": "Quest name is too long"
    },
    {
      "code": 6001,
      "name": "jarStillLocked",
      "msg": "Jar is still locked"
    },
    {
      "code": 6002,
      "name": "questInactive",
      "msg": "Quest is inactive"
    },
    {
      "code": 6003,
      "name": "questJarMismatch",
      "msg": "Quest does not belong to this jar"
    },
    {
      "code": 6004,
      "name": "balanceOverflow",
      "msg": "Balance overflow"
    },
    {
      "code": 6005,
      "name": "commentTooLong",
      "msg": "Comment is too long"
    },
    {
      "code": 6006,
      "name": "invalidDepositAmount",
      "msg": "Invalid deposit amount"
    },
    {
      "code": 6007,
      "name": "insufficientJarBalance",
      "msg": "Insufficient jar balance"
    },
    {
      "code": 6008,
      "name": "jarAlreadyUnlocked",
      "msg": "Jar already unlocked"
    },
    {
      "code": 6009,
      "name": "invalidMode",
      "msg": "Invalid unlock mode — must be 0 (date), 1 (goal), or 2 (either)"
    },
    {
      "code": 6010,
      "name": "goalAmountRequired",
      "msg": "Goal amount required for goal-based and combined unlock modes"
    }
  ],
  "types": [
    {
      "name": "contribution",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "jar",
            "type": "pubkey"
          },
          {
            "name": "contributor",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "comment",
            "type": "string"
          },
          {
            "name": "createdAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "jar",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "mode",
            "type": "u8"
          },
          {
            "name": "unlockDate",
            "type": "i64"
          },
          {
            "name": "goalAmount",
            "type": "u64"
          },
          {
            "name": "balance",
            "type": "u64"
          },
          {
            "name": "stakingShares",
            "type": "u64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "dailyLimit",
            "type": "u64"
          },
          {
            "name": "weeklyLimit",
            "type": "u64"
          },
          {
            "name": "childWallet",
            "type": "pubkey"
          },
          {
            "name": "childSpendableBalance",
            "type": "u64"
          },
          {
            "name": "unlocked",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "quest",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "jar",
            "type": "pubkey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "frequency",
            "type": "u8"
          },
          {
            "name": "lastPaid",
            "type": "i64"
          },
          {
            "name": "active",
            "type": "bool"
          }
        ]
      }
    }
  ]
};
