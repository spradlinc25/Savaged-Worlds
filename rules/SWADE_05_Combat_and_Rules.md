---
title: SWADE Combat and Rules 
type: rules_reference 
category: core_rules 
description: Complete mechanical reference for combat, damage, Wounds, Fatigue, and situational maneuvers in Savage Worlds Adventure Edition (SWADE). Claude should use this file to program the logic for action penalties, health tracking (Wounds/Fatigue), Target Numbers, and the effects of combat states (Shaken, Distracted, Vulnerable).
---
# Combat and Rules Mechanics

This section details the core resolution mechanics, combat turns, damage calculation, and health states.

## General Resolution

- **Trait Rolls:** When a character makes an Attribute or Skill roll, they roll the assigned die.
    
- **Wild Die:** Wild Cards (player characters and major NPCs) also roll a d6 Wild Die alongside their Trait die. They take the highest of the two dice.
    
- **Aces:** If any die rolls its maximum value (e.g., a 6 on a d6, an 8 on a d8), it "Aces." Roll it again and add the new value to the total. Dice can Ace infinitely.
    
- **Target Number (TN):** The standard Target Number for an action is 4.
    
- **Raises:** Every full 4 points rolled over the Target Number is a "Raise." (e.g., A total of 8 is one Raise against a TN of 4. A 12 is two Raises). Raises often grant bonus effects or extra damage.
    
- **Critical Failure:** If a Wild Card rolls a 1 on BOTH their Trait die and their Wild Die, it is a Critical Failure. This cannot be rerolled with a Benny.
    

## Bennies

Bennies are meta-currency tokens. Players start with 3 per session. They can be spent to:

1. **Reroll a Trait Roll:** Reroll the Trait die and Wild die and keep the best total.
    
2. **Recover from Shaken:** Instantly remove the Shaken status at any time (even interrupting another's action).
    
3. **Soak Wounds:** Roll Vigor to negate Wounds immediately after taking damage.
    
4. **Draw a New Action Card:** Get a new initiative card (unless the current card is a Joker).
    
5. **Reroll Damage:** Reroll the damage pool (weapons, spells, etc.).
    
6. **Regain Power Points:** Gain 5 Power Points (Arcane Backgrounds only).
    

## Combat Turns

- **Initiative:** Determined by drawing cards from a standard 54-card deck (including Jokers). Count down from Ace to Two. Ties are broken by suit: Spades ♠, Hearts ♥, Diamonds ♦, Clubs ♣.
    
- **The Joker:** Characters who draw a Joker can act at any time in the round, and add +2 to all Trait and damage rolls for that round.
    
- **Movement:** Characters can move up to their Pace in inches (1 inch = 2 yards) for free.
    
- **Running:** A character can roll their running die (d6) and add it to their Pace, but they suffer a -2 penalty to all actions that turn.
    
- **Multi-Action Penalty (MAP):** A character can take up to 3 actions in a turn. Each action beyond the first inflicts a cumulative -2 penalty to ALL actions taken that turn. (e.g., 2 actions = -2 to both; 3 actions = -4 to all three). You cannot perform the same action twice (e.g., you cannot cast the same spell twice, or attack with the same weapon twice, without a specific Edge like Frenzy or Rate of Fire).
    

## Attacks and Damage

- **Melee Attacks:** Roll Fighting. The Target Number is the opponent's **Parry**.
    
- **Ranged Attacks:** Roll Shooting or Athletics (throwing). The standard Target Number is **4**.
    
- **Bonus Damage:** If the attacker gets a Raise on their attack roll, they add +1d6 to the final damage total. (You only get this bonus once, regardless of how many Raises you get).
    

### Resolving Damage

Damage is compared to the target's **Toughness**.

- **Damage < Toughness:** The target's armor or hide absorbs the blow. No effect.
    
- **Damage >= Toughness:** The target is **Shaken**. (If the target is _already_ Shaken, they take 1 Wound instead).
    
- **Raises on Damage:** For every full 4 points the damage exceeds Toughness, the target takes 1 Wound.
    
    - _Example:_ Toughness is 6. Damage is 11. 11 beats 6, so the target is Shaken. It also beats it by 4 (10), so the target takes 1 Wound. (Total effect: Shaken and 1 Wound).
        

## Health and States

### Shaken

The character is rattled, shocked, or distracted.

- A Shaken character can only take free actions (like moving their Pace).
    
- At the start of their turn, a Shaken character must make a Spirit roll.
    
    - _Failure:_ They remain Shaken.
        
    - _Success:_ They remove the Shaken state but consume their action. They can only take free actions.
        
    - _Raise:_ They remove the Shaken state AND can act normally that turn.
        
- _Note:_ A player can spend a Benny at any time to instantly remove Shaken and act normally.
    

### Wounds

Wild Cards can take 3 Wounds. The 4th Wound causes Incapacitation.

- **Wound Penalties:** Each Wound inflicts a -1 penalty to all Trait rolls (Agility, Smarts, Spirit, Strength, Vigor, and all skills) and reduces Pace by 1. Max penalty is -3.
    
- **Soaking Wounds:** Immediately after taking Wounds, a character may spend a Benny to make a Vigor roll. A success negates 1 Wound. Each Raise negates 1 additional Wound. If all Wounds from an attack are Soaked, the character also removes the Shaken status caused by that attack.
    

### Fatigue

Fatigue represents exhaustion, starvation, or environmental exposure. Characters can take 2 levels of Fatigue (Fatigued, then Exhausted). The 3rd level causes Incapacitation.

- **Fatigued:** -1 to all Trait rolls.
    
- **Exhausted:** -2 to all Trait rolls.
    
- _Note:_ Fatigue penalties stack with Wound penalties (maximum total penalty of -5).
    

### Incapacitation

When a character takes more than 3 Wounds or more than 2 Fatigue, they are Incapacitated.

- They fall prone and cannot take actions.
    
- They must immediately make a Vigor roll (applying Wound penalties) to determine if they survive, bleed out, or sustain a permanent injury.
    

## Situational Combat Maneuvers

- **Aim:** Spend a full turn aiming (no movement, no other actions). On the next turn, ignore up to 4 points of Range/Cover/Called Shot penalties, or add +2 to the attack roll.
    
- **Called Shots:** Attacking a specific body part. Head (-4 attack, +4 damage), Unarmored Area (Bypasses armor, attack penalty depends on size of gap).
    
- **Defend:** Character takes no actions other than moving up to their Pace. Their Parry increases by +4 until their next turn.
    
- **The Drop:** Attacking an entirely unaware or bound opponent. The attacker adds +4 to the attack roll AND +4 to the damage roll.
    
- **Gang Up:** Each additional adjacent attacker beyond the first adds +1 to the Fighting roll of all attackers, up to a maximum of +4.
    
- **Tests:** Using a skill (like Taunt, Intimidation, or Athletics) to distract or trick a foe. The attacker rolls their skill opposed by the defender's linked attribute.
    
    - _Success:_ The defender is **Distracted** (-2 to all Trait rolls until the end of their next turn) OR **Vulnerable** (Actions against the defender are at +2 until the end of their next turn). The attacker chooses.
        
    - _Raise:_ The defender is Distracted/Vulnerable AND becomes Shaken.
        
- **Wild Attack:** The character throws caution to the wind. They add +2 to their Fighting roll and +2 to their melee damage roll, but they become **Vulnerable** until the end of their next turn.