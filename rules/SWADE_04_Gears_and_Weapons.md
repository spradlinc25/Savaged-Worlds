---
title: SWADE Gear and Weapons 
type: rules_reference 
category: equipment 
description: Complete mechanical reference for Savage Worlds gear, encumbrance, armor, and weapons. Contains formulas for carrying capacity, armor bonuses, weapon damage, and special weapon tags (AP, Reach, etc.). Claude should use this to calculate total Toughness (including armor), melee/ranged damage, and encumbrance penalties.
---

# Gear and Weapons

This section covers the mechanics of carrying equipment, wearing armor, and wielding weapons.

## Wealth and Currency

- **Starting Wealth:** Characters begin with $500 for standard settings.
    
- **Currency:** Prices are listed in generic dollars ($) for universal setting conversion.
    

## Encumbrance

Characters can only carry so much weight before it hinders their movement and actions.

- **Carrying Capacity:** A character can carry their **Strength die x 5** in pounds without penalty (e.g., Strength d6 = 30 lbs).
    
    - _Note:_ The _Brawny_ Edge treats Strength as one die type higher for this calculation.
        
- **Encumbered Penalty:** For every multiple of their carrying capacity a character exceeds, they suffer a -1 penalty to Pace (minimum 1), running rolls, Agility, and all Agility-linked skills.
    
- **Maximum Weight:** A character cannot carry more than three times their carrying capacity (max penalty -3).
    

## Armor Mechanics

Armor protects a character by adding a flat bonus to their Toughness.

- **Notation:** Armor is typically written in parentheses next to Toughness. E.g., a character with 5 Toughness wearing +2 Armor is written as **Toughness: 7 (2)**.
    
- **Stacking:** Armor from different sources does _not_ stack. If a character wears a leather jacket (+1) and a Kevlar vest (+2) on their torso, they only get the +2 bonus.
    
- **Armor Piercing (AP):** Weapons with an AP value ignore that many points of Armor. AP can never reduce base Toughness, only the Armor bonus.
    
- **Minimum Strength:** If a character does not meet the Minimum Strength (Min Str) required for armor, they subtract 1 from Agility and Agility-linked skills for each die step they are short.
    

### Common Armor Table

|   |   |   |   |   |
|---|---|---|---|---|
|**Item**|**Armor Bonus**|**Min Str**|**Weight**|**Locations Covered**|
|Leather/Thick Hide|+1|d4|15|Torso, Arms, Legs|
|Chain Shirt|+2|d6|25|Torso, Arms|
|Plate Corselet|+3|d8|25|Torso|
|Kevlar Vest|+2|d4|8|Torso (Negates up to 4 AP from bullets)|
|Riot Shield|+3 Parry|d4|5|(Provides Cover against ranged attacks)|
|Medium Shield|+2 Parry|d6|12|(Provides Cover against ranged attacks)|

## Weapon Mechanics

Weapons deal damage and may possess special tags that alter combat math.

- **Melee Damage:** Melee weapons deal damage equal to the wielder's Strength die plus a weapon die (e.g., Str+d6).
    
- **Ranged Damage:** Ranged weapons deal a flat set of dice (e.g., 2d6).
    
- **Minimum Strength (Min Str):** If a character lacks the Min Str for a weapon, they suffer a -1 penalty to attack rolls (and Parry, if melee) for each die step they are short. Damage is capped at the wielder's Strength die if it's a melee weapon.
    

### Weapon Tags & Special Rules

- **Armor Piercing (AP):** Ignores an amount of Armor equal to the AP value.
    
- **Heavy Weapon (HW):** This weapon can damage vehicles and creatures with Heavy Armor. Standard weapons cannot harm Heavy Armor.
    
- **Parry +X / -X:** The weapon modifies the wielder's Parry by this amount while held.
    
- **Reach X:** The weapon can attack targets X inches (2 yards per inch) away.
    
- **Two-Handed:** Requires two hands to use.
    
- **Snapfire:** Suffer a -2 penalty to the attack roll if the character moves in the same turn.
    
- **Reload X:** Takes X actions to reload the weapon before it can be fired again.
    
- **RoF (Rate of Fire):** The number of Shooting dice rolled in a single action. Most weapons are RoF 1.
    

### Melee Weapons Table

|   |   |   |   |   |
|---|---|---|---|---|
|**Weapon**|**Damage**|**Min Str**|**Weight**|**Special Notes**|
|Unarmed|Str|d4|-|Innate. Counts as armed if character has Martial Artist.|
|Knife / Dagger|Str+d4|d4|1|-|
|Short Sword|Str+d6|d4|2|-|
|Long Sword / Axe|Str+d8|d6|3|-|
|Greatsword|Str+d10|d10|6|Parry -1, Two-Handed|
|Halberd / Polearm|Str+d8|d8|6|Reach 1, Two-Handed|
|Staff|Str+d4|d4|4|Parry +1, Reach 1, Two-Handed|
|Warhammer|Str+d6|d6|2|AP 1|

### Ranged Weapons Table

|   |   |   |   |   |   |   |   |
|---|---|---|---|---|---|---|---|
|**Weapon**|**Range (S/M/L)**|**Damage**|**AP**|**RoF**|**Min Str**|**Weight**|**Special Notes**|
|Bow|12/24/48|2d6|0|1|d6|3|Two-Handed|
|Crossbow|15/30/60|2d6|2|1|d6|5|Reload 1, Two-Handed|
|Pistol, Light (9mm)|12/24/48|2d6|1|1|d4|2|-|
|Pistol, Heavy (.45)|12/24/48|2d6+1|1|1|d4|3|-|
|Revolver (.357)|12/24/48|2d6+1|1|1|d4|2|-|
|Submachine Gun|12/24/48|2d6|1|3|d4|6|-|
|Assault Rifle|24/48/96|2d8|2|3|d6|8|Two-Handed|
|Sniper Rifle|50/100/200|2d10|2|1|d6|8|Snapfire, Two-Handed|
|Shotgun (Slug)|12/24/48|2d10|0|1|d6|7|Two-Handed|
|Shotgun (Buckshot)|12/24/48|1-3d6*|0|1|d6|7|*Damage is 3d6 at Short, 2d6 at Medium, 1d6 at Long. +2 to hit.|
|Laser Pistol|15/30/60|2d6|2|1|d4|2|-|
|Laser Rifle|30/60/120|3d6|2|1|d6|5|Two-Handed|