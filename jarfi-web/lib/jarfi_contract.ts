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
      "name": "createUsdcJar",
      "discriminator": [
        226,
        159,
        171,
        137,
        88,
        224,
        56,
        95
      ],
      "accounts": [
        {
          "name": "jar",
          "writable": true,
          "signer": true
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "jar"
              }
            ]
          }
        },
        {
          "name": "jarUsdcVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vaultAuthority"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
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
      "name": "depositUsdc",
      "discriminator": [
        184,
        148,
        250,
        169,
        224,
        213,
        34,
        126
      ],
      "accounts": [
        {
          "name": "jar",
          "writable": true
        },
        {
          "name": "jarUsdcVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vaultAuthority"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "jar"
              }
            ]
          }
        },
        {
          "name": "depositorUsdcAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "depositor"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "depositor",
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
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
      "name": "giftDepositUsdc",
      "discriminator": [
        131,
        67,
        200,
        189,
        102,
        223,
        118,
        145
      ],
      "accounts": [
        {
          "name": "jar",
          "writable": true
        },
        {
          "name": "jarUsdcVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vaultAuthority"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "jar"
              }
            ]
          }
        },
        {
          "name": "contribution",
          "writable": true,
          "signer": true
        },
        {
          "name": "contributorUsdcAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "contributor"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "contributor",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
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
      "name": "setKaminoObligation",
      "discriminator": [
        250,
        216,
        2,
        135,
        190,
        119,
        163,
        255
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
          "name": "obligation",
          "type": "pubkey"
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
    },
    {
      "name": "withdrawUsdc",
      "discriminator": [
        114,
        49,
        72,
        184,
        27,
        156,
        243,
        155
      ],
      "accounts": [
        {
          "name": "jar",
          "writable": true
        },
        {
          "name": "jarUsdcVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vaultAuthority"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "jar"
              }
            ]
          }
        },
        {
          "name": "ownerUsdcAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "jar"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
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
    },
    {
      "code": 6011,
      "name": "wrongCurrency",
      "msg": "Operation not supported for this jar currency"
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
          },
          {
            "name": "jarCurrency",
            "type": "u8"
          },
          {
            "name": "usdcBalance",
            "type": "u64"
          },
          {
            "name": "usdcVault",
            "type": "pubkey"
          },
          {
            "name": "kaminoObligation",
            "type": "pubkey"
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
