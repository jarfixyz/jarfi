/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/jarfi.json`.
 */
export type Jarfi = {
  "address": "GBqqB8ZfNDPRyUZczbUxkmU3UopQ1BFMPu4sXGd115yF",
  "metadata": {
    "name": "jarfi",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "jarfi: Solana savings jars"
  },
  "instructions": [
    {
      "name": "acceptAdmin",
      "discriminator": [
        112,
        42,
        45,
        90,
        116,
        181,
        13,
        170
      ],
      "accounts": [
        {
          "name": "newAdmin",
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "cancelJar",
      "discriminator": [
        115,
        245,
        126,
        254,
        208,
        220,
        212,
        13
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "jar"
          ]
        },
        {
          "name": "jar",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "closeContribution",
      "discriminator": [
        212,
        162,
        137,
        29,
        10,
        95,
        186,
        129
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "jar",
          "writable": true
        },
        {
          "name": "donor",
          "writable": true
        },
        {
          "name": "contribution",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  116,
                  114,
                  105,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "jar"
              },
              {
                "kind": "account",
                "path": "donor"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "closeJar",
      "discriminator": [
        92,
        189,
        114,
        36,
        186,
        123,
        0,
        163
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "jar"
          ]
        },
        {
          "name": "jar",
          "writable": true
        },
        {
          "name": "jarVault",
          "writable": true,
          "optional": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "jar"
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
                "path": "jar.mint",
                "account": "jar"
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
          "name": "ownerTokenAccount",
          "writable": true,
          "optional": true
        },
        {
          "name": "tokenProgram",
          "optional": true,
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "contributeSol",
      "discriminator": [
        186,
        36,
        137,
        50,
        25,
        152,
        8,
        5
      ],
      "accounts": [
        {
          "name": "donor",
          "writable": true,
          "signer": true
        },
        {
          "name": "jar",
          "writable": true
        },
        {
          "name": "contribution",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  116,
                  114,
                  105,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "jar"
              },
              {
                "kind": "account",
                "path": "donor"
              }
            ]
          }
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
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
        }
      ]
    },
    {
      "name": "contributeSpl",
      "discriminator": [
        56,
        201,
        213,
        12,
        65,
        27,
        3,
        245
      ],
      "accounts": [
        {
          "name": "donor",
          "writable": true,
          "signer": true
        },
        {
          "name": "jar",
          "writable": true
        },
        {
          "name": "contribution",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  116,
                  114,
                  105,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "jar"
              },
              {
                "kind": "account",
                "path": "donor"
              }
            ]
          }
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "donorTokenAccount",
          "writable": true
        },
        {
          "name": "jarVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "jar"
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
                "path": "jar.mint",
                "account": "jar"
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
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
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
        }
      ]
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
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "userState"
          ]
        },
        {
          "name": "userState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "jar",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  106,
                  97,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "account",
                "path": "user_state.jar_count",
                "account": "userState"
              }
            ]
          }
        },
        {
          "name": "jarVault",
          "writable": true,
          "optional": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "jar"
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
                "path": "vaultMint"
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
          "name": "vaultMint",
          "optional": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "jarType",
          "type": {
            "defined": {
              "name": "jarType"
            }
          }
        },
        {
          "name": "asset",
          "type": {
            "defined": {
              "name": "asset"
            }
          }
        },
        {
          "name": "goalAmount",
          "type": "u64"
        },
        {
          "name": "unlockTimestamp",
          "type": "i64"
        },
        {
          "name": "metadataUri",
          "type": "string"
        },
        {
          "name": "metadataHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "autoStake",
          "type": "bool"
        }
      ]
    },
    {
      "name": "initUserState",
      "discriminator": [
        229,
        142,
        179,
        158,
        177,
        92,
        220,
        92
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "userState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializeConfig",
      "discriminator": [
        208,
        127,
        21,
        1,
        194,
        190,
        196,
        70
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "treasury",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "creationFeeLamports",
          "type": "u64"
        },
        {
          "name": "withdrawFeeBps",
          "type": "u16"
        },
        {
          "name": "allowedUsdcMint",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "migrateConfigV2",
      "discriminator": [
        21,
        39,
        88,
        172,
        254,
        205,
        30,
        141
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "proposeAdmin",
      "discriminator": [
        121,
        214,
        199,
        212,
        87,
        39,
        117,
        234
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newAdmin",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "refund",
      "discriminator": [
        2,
        96,
        183,
        251,
        63,
        208,
        46,
        46
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "jar",
          "writable": true
        },
        {
          "name": "donor",
          "writable": true
        },
        {
          "name": "contribution",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  116,
                  114,
                  105,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "jar"
              },
              {
                "kind": "account",
                "path": "donor"
              }
            ]
          }
        },
        {
          "name": "jarVault",
          "writable": true,
          "optional": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "jar"
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
                "path": "jar.mint",
                "account": "jar"
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
          "name": "donorTokenAccount",
          "writable": true,
          "optional": true
        },
        {
          "name": "tokenProgram",
          "optional": true,
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "updateConfig",
      "discriminator": [
        29,
        158,
        252,
        191,
        10,
        83,
        219,
        99
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newCreationFee",
          "type": {
            "option": "u64"
          }
        },
        {
          "name": "newWithdrawFeeBps",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "feeEnabled",
          "type": {
            "option": "bool"
          }
        },
        {
          "name": "paused",
          "type": {
            "option": "bool"
          }
        },
        {
          "name": "newAllowedUsdcMint",
          "type": {
            "option": "pubkey"
          }
        },
        {
          "name": "newMinAutoStakeLockDays",
          "type": {
            "option": "u16"
          }
        }
      ]
    },
    {
      "name": "updateMarginfiConfig",
      "discriminator": [
        56,
        56,
        44,
        195,
        150,
        113,
        121,
        236
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "marginFiConfigArgs"
            }
          }
        }
      ]
    },
    {
      "name": "updateMetadata",
      "discriminator": [
        170,
        182,
        43,
        239,
        97,
        78,
        225,
        186
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "jar"
          ]
        },
        {
          "name": "jar",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "newUri",
          "type": "string"
        },
        {
          "name": "newHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "withdraw",
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "jar"
          ]
        },
        {
          "name": "jar",
          "writable": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "jarVault",
          "writable": true,
          "optional": true
        },
        {
          "name": "ownerTokenAccount",
          "writable": true,
          "optional": true
        },
        {
          "name": "treasuryTokenAccount",
          "writable": true,
          "optional": true
        },
        {
          "name": "tokenProgram",
          "optional": true,
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": {
            "option": "u64"
          }
        }
      ]
    },
    {
      "name": "withdrawTreasury",
      "discriminator": [
        40,
        63,
        122,
        158,
        144,
        216,
        83,
        96
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "destination",
          "writable": true
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
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
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
      "name": "userState",
      "discriminator": [
        72,
        177,
        85,
        249,
        76,
        167,
        186,
        126
      ]
    }
  ],
  "events": [
    {
      "name": "adminAcceptedEvent",
      "discriminator": [
        14,
        221,
        60,
        92,
        241,
        147,
        95,
        66
      ]
    },
    {
      "name": "adminProposedEvent",
      "discriminator": [
        212,
        163,
        91,
        28,
        223,
        95,
        2,
        102
      ]
    },
    {
      "name": "cancelEvent",
      "discriminator": [
        71,
        137,
        239,
        100,
        220,
        3,
        242,
        47
      ]
    },
    {
      "name": "closeJarEvent",
      "discriminator": [
        141,
        169,
        253,
        165,
        192,
        192,
        205,
        38
      ]
    },
    {
      "name": "configUpdatedEvent",
      "discriminator": [
        245,
        158,
        129,
        99,
        60,
        100,
        214,
        220
      ]
    },
    {
      "name": "contributeEvent",
      "discriminator": [
        147,
        4,
        47,
        213,
        204,
        84,
        46,
        189
      ]
    },
    {
      "name": "createJarEvent",
      "discriminator": [
        134,
        236,
        51,
        247,
        3,
        100,
        181,
        210
      ]
    },
    {
      "name": "metadataUpdatedEvent",
      "discriminator": [
        66,
        19,
        187,
        5,
        244,
        90,
        125,
        113
      ]
    },
    {
      "name": "refundEvent",
      "discriminator": [
        176,
        159,
        218,
        59,
        94,
        213,
        129,
        218
      ]
    },
    {
      "name": "treasuryWithdrawEvent",
      "discriminator": [
        75,
        76,
        60,
        106,
        68,
        109,
        219,
        136
      ]
    },
    {
      "name": "withdrawEvent",
      "discriminator": [
        22,
        9,
        133,
        26,
        160,
        44,
        71,
        192
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "feeTooHigh",
      "msg": "Fee basis points exceed the 5% hard cap"
    },
    {
      "code": 6001,
      "name": "creationFeeTooHigh",
      "msg": "Creation fee exceeds hard cap"
    },
    {
      "code": 6002,
      "name": "metadataUriTooLong",
      "msg": "Metadata URI exceeds maximum length"
    },
    {
      "code": 6003,
      "name": "unlockInPast",
      "msg": "Unlock timestamp must be in the future"
    },
    {
      "code": 6004,
      "name": "unlockTooFar",
      "msg": "Unlock timestamp exceeds maximum duration"
    },
    {
      "code": 6005,
      "name": "unlockNotAllowed",
      "msg": "Unlock timestamp must be zero for Flexible jars"
    },
    {
      "code": 6006,
      "name": "notOwner",
      "msg": "Signer is not the jar owner"
    },
    {
      "code": 6007,
      "name": "notAdmin",
      "msg": "Signer is not the admin"
    },
    {
      "code": 6008,
      "name": "noPendingAdmin",
      "msg": "No pending admin transfer in progress"
    },
    {
      "code": 6009,
      "name": "notPendingAdmin",
      "msg": "Signer is not the pending admin"
    },
    {
      "code": 6010,
      "name": "jarNotActive",
      "msg": "Jar is not in Active status"
    },
    {
      "code": 6011,
      "name": "jarNotCancelled",
      "msg": "Jar is not in Cancelled status"
    },
    {
      "code": 6012,
      "name": "jarNotWithdrawn",
      "msg": "Jar is not in Withdrawn status"
    },
    {
      "code": 6013,
      "name": "stillLocked",
      "msg": "Time-locked jar cannot be withdrawn before unlock"
    },
    {
      "code": 6014,
      "name": "partialWithdrawNotAllowed",
      "msg": "Partial withdraw is only allowed for Flexible jars"
    },
    {
      "code": 6015,
      "name": "cancelNotAllowed",
      "msg": "Cancel is only valid for Time-locked jars before unlock"
    },
    {
      "code": 6016,
      "name": "refundNotAllowed",
      "msg": "Refund is only valid for Cancelled jars"
    },
    {
      "code": 6017,
      "name": "paused",
      "msg": "Program is paused"
    },
    {
      "code": 6018,
      "name": "contributorsRemain",
      "msg": "Jar still has active contributors; cannot close"
    },
    {
      "code": 6019,
      "name": "overflow",
      "msg": "Amount overflow"
    },
    {
      "code": 6020,
      "name": "zeroAmount",
      "msg": "Contribution amount must be greater than zero"
    },
    {
      "code": 6021,
      "name": "wrongAsset",
      "msg": "Wrong asset type for this instruction"
    },
    {
      "code": 6022,
      "name": "contributionJarMismatch",
      "msg": "Contribution does not belong to this jar"
    },
    {
      "code": 6023,
      "name": "alreadyRefunded",
      "msg": "Contribution has already been refunded"
    },
    {
      "code": 6024,
      "name": "insufficientBalance",
      "msg": "Insufficient jar balance"
    },
    {
      "code": 6025,
      "name": "closeNotAllowed",
      "msg": "Jar cannot be closed in its current state"
    },
    {
      "code": 6026,
      "name": "disallowedUsdcMint",
      "msg": "USDC jar uses a mint that is not the admin-approved canonical mint"
    },
    {
      "code": 6027,
      "name": "migrationNotNeeded",
      "msg": "Config migration is not needed (already at current version)"
    },
    {
      "code": 6028,
      "name": "autoStakeDisabled",
      "msg": "Auto-staking is disabled in config"
    },
    {
      "code": 6029,
      "name": "autoStakeMintMismatch",
      "msg": "Auto-stake jars must use the configured USDC mint"
    },
    {
      "code": 6030,
      "name": "autoStakeUnsupportedAsset",
      "msg": "Auto-stake not supported for this asset"
    },
    {
      "code": 6031,
      "name": "marginFiAccountMismatch",
      "msg": "MarginFi account does not match jar or config"
    },
    {
      "code": 6032,
      "name": "autoStakeRequiresTimeLocked",
      "msg": "Auto-stake on SOL requires a TimeLocked jar"
    },
    {
      "code": 6033,
      "name": "autoStakeLockTooShort",
      "msg": "Time-lock duration is below configured minimum for auto-stake"
    },
    {
      "code": 6034,
      "name": "marinadeAccountMismatch",
      "msg": "Marinade account does not match pinned program constants"
    },
    {
      "code": 6035,
      "name": "sharesUnderflow",
      "msg": "Shares accounting underflow"
    },
    {
      "code": 6036,
      "name": "principalUnderflow",
      "msg": "Principal accounting underflow"
    }
  ],
  "types": [
    {
      "name": "adminAcceptedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "oldAdmin",
            "type": "pubkey"
          },
          {
            "name": "newAdmin",
            "type": "pubkey"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "adminProposedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "pendingAdmin",
            "type": "pubkey"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "asset",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "sol"
          },
          {
            "name": "usdc"
          }
        ]
      }
    },
    {
      "name": "cancelEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "jar",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "closeJarEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "jar",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "config",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "pendingAdmin",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "treasuryBump",
            "type": "u8"
          },
          {
            "name": "creationFeeLamports",
            "type": "u64"
          },
          {
            "name": "withdrawFeeBps",
            "type": "u16"
          },
          {
            "name": "feeEnabled",
            "type": "bool"
          },
          {
            "name": "paused",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "allowedUsdcMint",
            "type": "pubkey"
          },
          {
            "name": "autoStakeEnabled",
            "type": "bool"
          },
          {
            "name": "marginfiProgram",
            "type": "pubkey"
          },
          {
            "name": "marginfiGroup",
            "type": "pubkey"
          },
          {
            "name": "marginfiUsdcBank",
            "type": "pubkey"
          },
          {
            "name": "minAutoStakeLockDays",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "configUpdatedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "creationFeeLamports",
            "type": "u64"
          },
          {
            "name": "withdrawFeeBps",
            "type": "u16"
          },
          {
            "name": "feeEnabled",
            "type": "bool"
          },
          {
            "name": "paused",
            "type": "bool"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "contributeEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "jar",
            "type": "pubkey"
          },
          {
            "name": "donor",
            "type": "pubkey"
          },
          {
            "name": "amountDelta",
            "type": "u64"
          },
          {
            "name": "totalAfter",
            "type": "u64"
          },
          {
            "name": "contributorsAfter",
            "type": "u32"
          },
          {
            "name": "isFirst",
            "type": "bool"
          },
          {
            "name": "ts",
            "type": "i64"
          },
          {
            "name": "sharesDelta",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "contribution",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "jar",
            "type": "pubkey"
          },
          {
            "name": "donor",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "shares",
            "type": "u64"
          },
          {
            "name": "firstContributedAt",
            "type": "i64"
          },
          {
            "name": "lastContributedAt",
            "type": "i64"
          },
          {
            "name": "refunded",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "createJarEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "jar",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "jarType",
            "type": "u8"
          },
          {
            "name": "asset",
            "type": "u8"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "goalAmount",
            "type": "u64"
          },
          {
            "name": "unlockTimestamp",
            "type": "i64"
          },
          {
            "name": "metadataUri",
            "type": "string"
          },
          {
            "name": "metadataHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
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
            "name": "version",
            "type": "u8"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "jarType",
            "type": {
              "defined": {
                "name": "jarType"
              }
            }
          },
          {
            "name": "asset",
            "type": {
              "defined": {
                "name": "asset"
              }
            }
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "goalAmount",
            "type": "u64"
          },
          {
            "name": "unlockTimestamp",
            "type": "i64"
          },
          {
            "name": "totalContributed",
            "type": "u64"
          },
          {
            "name": "totalContributors",
            "type": "u32"
          },
          {
            "name": "metadataUri",
            "type": "string"
          },
          {
            "name": "metadataHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "jarStatus"
              }
            }
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "autoStake",
            "type": "bool"
          },
          {
            "name": "stakeProtocol",
            "type": "u8"
          },
          {
            "name": "principalTotal",
            "type": "u64"
          },
          {
            "name": "sharesTotal",
            "type": "u64"
          },
          {
            "name": "marginfiAccount",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "jarStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "active"
          },
          {
            "name": "withdrawn"
          },
          {
            "name": "cancelled"
          }
        ]
      }
    },
    {
      "name": "jarType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "flexible"
          },
          {
            "name": "timeLocked"
          }
        ]
      }
    },
    {
      "name": "marginFiConfigArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "autoStakeEnabled",
            "type": "bool"
          },
          {
            "name": "marginfiProgram",
            "type": "pubkey"
          },
          {
            "name": "marginfiGroup",
            "type": "pubkey"
          },
          {
            "name": "marginfiUsdcBank",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "metadataUpdatedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "jar",
            "type": "pubkey"
          },
          {
            "name": "oldHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "newHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "newUri",
            "type": "string"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "refundEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "jar",
            "type": "pubkey"
          },
          {
            "name": "donor",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "ts",
            "type": "i64"
          },
          {
            "name": "sharesRedeemed",
            "type": "u64"
          },
          {
            "name": "grossUnderlying",
            "type": "u64"
          },
          {
            "name": "protocol",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "treasuryWithdrawEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "destination",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "ts",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "userState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "jarCount",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "withdrawEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "jar",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "fee",
            "type": "u64"
          },
          {
            "name": "ts",
            "type": "i64"
          },
          {
            "name": "sharesRedeemed",
            "type": "u64"
          },
          {
            "name": "grossUnderlying",
            "type": "u64"
          },
          {
            "name": "protocol",
            "type": "u8"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "stateVersion",
      "type": "u8",
      "value": "1"
    }
  ]
};
