# v1.9 combat key poses for tools/hero-rig.py (exec'd there). Each: hip_h, lean (+ = forward), feet [(near), (far)] as (x from hip, lift, boot angle),
# arms [(near: shoulder deg, elbow deg), (far)], cape / sprout swing, smear = ghost near-arm angles along the swing path (drawn faint).
# Naming: c_<move>_<a|s|f>  a = anticipation, s = smear (mid swing), f = follow-through / contact hold.
COMBAT = {
  # 1 horizontal slash: cock high behind -> sweep across -> follow through low
  'c_cut_a':  dict(hip_h=37, lean=-8, feet=[(14, 0, -6), (-14, 0, 4)], arms=[(-150, -30), (40, 30)], cape=8, sprout=-10),
  'c_cut_s':  dict(hip_h=35, lean=8, feet=[(20, 0, -8), (-16, 0, 6)], arms=[(95, 5), (-30, 40)], cape=-8, sprout=6, smear=[-170, -130, -80, -20, 40]),
  'c_cut_f':  dict(hip_h=34, lean=14, feet=[(22, 0, -8), (-18, 2, 14)], arms=[(55, 20), (-50, 40)], cape=-14, sprout=10),
  # 2 reverse slash: low across the body -> rising backhand -> high behind
  'c_rev_a':  dict(hip_h=35, lean=12, feet=[(20, 0, -6), (-14, 0, 6)], arms=[(30, -40), (-20, 30)], cape=-10, sprout=8),
  'c_rev_s':  dict(hip_h=36, lean=2, feet=[(18, 0, -4), (-16, 0, 4)], arms=[(130, 10), (-40, 30)], cape=-4, sprout=-4, smear=[40, 70, 100]),
  'c_rev_f':  dict(hip_h=38, lean=-6, feet=[(16, 0, -2), (-14, 3, 8)], arms=[(170, 10), (-60, 20)], cape=6, sprout=-12),
  # 3 spinning slash: wound-up crouch -> arm flung out flat (game flips facing mid-spin for the back half)
  'c_spin_a': dict(hip_h=33, lean=10, feet=[(16, 0, -4), (-12, 0, 4)], arms=[(-40, 80), (20, 60)], cape=-16, sprout=10),
  'c_spin_s': dict(hip_h=35, lean=4, feet=[(10, 4, 0), (-10, 0, 0)], arms=[(92, 0), (-92, 0)], cape=-24, sprout=14, smear=[20, 50, 70]),
  # 4 lunging thrust: deep coil -> full extension
  'c_lunge_a': dict(hip_h=32, lean=-4, feet=[(16, 0, -4), (-18, 0, 8)], arms=[(-60, 110), (30, 40)], cape=4, sprout=-6),
  'c_lunge_f': dict(hip_h=29, lean=22, feet=[(34, 0, -14), (-30, 4, 30)], arms=[(88, 0), (-70, 10)], cape=-26, sprout=16, smear=[70, 80]),
  # 5 finisher: overhead raise -> slam to the ground
  'c_slam_a': dict(hip_h=41, lean=-10, feet=[(10, 6, -4), (-10, 3, 6)], arms=[(185, -10), (165, -10)], cape=10, sprout=-14),
  'c_slam_f': dict(hip_h=27, lean=26, feet=[(26, 0, -10), (-22, 0, 20)], arms=[(48, 6), (30, 10)], cape=-30, sprout=18, smear=[180, 140, 100]),
  # launcher (up + attack): crouch -> rising uppercut
  'c_rise_a': dict(hip_h=30, lean=14, feet=[(16, 0, -6), (-14, 0, 8)], arms=[(-30, 30), (20, 40)], cape=-8, sprout=8),
  'c_rise_f': dict(hip_h=44, lean=-6, feet=[(8, 14, -10), (-8, 0, 10)], arms=[(172, 4), (-30, 20)], cape=14, sprout=-18, smear=[20, 70, 120]),
  # air: back-cock -> sweep (legs tucked) ; air spin ball
  'c_air_a':  dict(hip_h=38, lean=-6, feet=[(10, 14, -10), (-10, 8, 10)], arms=[(-160, -20), (60, 30)], cape=10, sprout=-10),
  'c_air_f':  dict(hip_h=38, lean=16, feet=[(14, 16, -14), (-12, 10, 16)], arms=[(70, 20), (-60, 30)], cape=-12, sprout=12, smear=[-140, -80, -20, 30]),
  'c_airspin': dict(hip_h=34, lean=30, feet=[(14, 20, -20), (-4, 18, 10)], arms=[(100, -6), (-90, 10)], cape=-30, sprout=20, smear=[40, 70]),
  # plunge: tucked dive, blade straight down ; landing crouch
  'c_plunge': dict(hip_h=40, lean=4, feet=[(12, 22, -24), (-10, 18, 10)], arms=[(18, 0), (-20, 20)], cape=24, sprout=-24),
  'c_plunge_l': dict(hip_h=24, lean=18, feet=[(22, 0, -10), (-20, 0, 18)], arms=[(26, -6), (-40, 30)], cape=-20, sprout=14),
  # hook-swing kick: near leg extended forward, arms flung back
  'c_kick':   dict(hip_h=40, lean=-14, feet=[(34, 22, -50), (-10, 10, 10)], arms=[(-60, 20), (-80, 20)], cape=-6, sprout=-14),
  # dash slash: low forward rush, blade trailing behind after the cut
  'c_dash':   dict(hip_h=30, lean=30, feet=[(28, 2, -12), (-28, 6, 34)], arms=[(-100, -10), (-60, 20)], cape=-34, sprout=20, smear=[60, 10, -50]),
  # parry counter: stepping slash across
  'c_counter': dict(hip_h=31, lean=20, feet=[(28, 0, -12), (-24, 2, 22)], arms=[(110, -20), (-70, 20)], cape=-22, sprout=14, smear=[200, 170, 140]),
  # charged whirlwind: wide stance, both arms flung out
  'c_whirl':  dict(hip_h=34, lean=2, feet=[(18, 0, -6), (-18, 0, 6)], arms=[(96, 0), (-96, 0)], cape=-28, sprout=16),
  # charge hold: coiled, blade low behind
  'c_charge': dict(hip_h=31, lean=6, feet=[(18, 0, -6), (-16, 0, 8)], arms=[(-70, 60), (40, 50)], cape=4, sprout=-8),
  # bloom special: arms raised to the sky
  'c_bloom':  dict(hip_h=43, lean=-8, feet=[(12, 0, -4), (-12, 0, 4)], arms=[(160, -10), (200, 10)], cape=14, sprout=-20),
  # ---- v2.4 feel pass ----
  # hook swing: hang at the bottom, legs trailing on the down-swing, legs leading on the up-swing, release tuck (game spins it into a flip)
  'c_swing_m': dict(hip_h=40, lean=2, feet=[(4, 12, -8), (-6, 8, 8)], arms=[(178, 6), (150, 24)], cape=-16, sprout=-10),
  'c_swing_b': dict(hip_h=40, lean=16, feet=[(-8, 16, 24), (-18, 10, 34)], arms=[(170, 4), (135, 30)], cape=-28, sprout=14),
  'c_swing_f': dict(hip_h=38, lean=-14, feet=[(22, 22, -30), (12, 16, -16)], arms=[(186, 0), (160, 14)], cape=-12, sprout=-16),
  'c_tuck':    dict(hip_h=30, lean=28, feet=[(12, 22, -30), (4, 20, -20)], arms=[(50, 70), (40, 80)], cape=-22, sprout=18),
  # vine whip: cock overhead-back -> throw over the top -> follow-through/recoil ; up lash ; air down lash
  'c_whip_a':  dict(hip_h=37, lean=-12, feet=[(16, 0, -6), (-17, 0, 8)], arms=[(-150, -40), (50, 30)], cape=10, sprout=-12),
  'c_whip_s':  dict(hip_h=35, lean=10, feet=[(22, 0, -8), (-17, 0, 8)], arms=[(125, 0), (-35, 40)], cape=-10, sprout=8, smear=[-165, 175, 150]),
  'c_whip_f':  dict(hip_h=34, lean=16, feet=[(24, 0, -8), (-19, 2, 14)], arms=[(62, 12), (-50, 40)], cape=-16, sprout=12),
  'c_whipup_s': dict(hip_h=40, lean=-6, feet=[(14, 0, -4), (-14, 0, 6)], arms=[(172, 0), (-40, 30)], cape=6, sprout=-14, smear=[60, 110, 150]),
  'c_whipdn_s': dict(hip_h=38, lean=18, feet=[(12, 18, -16), (-8, 12, 14)], arms=[(38, 0), (-60, 30)], cape=-18, sprout=14, smear=[140, 100, 70]),
  # thornbow: nock (arrow to the string) -> full draw -> release (string hand flies back)
  'c_bow_nock': dict(hip_h=36, lean=2, feet=[(18, 0, -6), (-16, 0, 8)], arms=[(88, 0), (70, 40)], cape=2, sprout=-4),
  'c_bow_draw': dict(hip_h=36, lean=-4, feet=[(19, 0, -6), (-17, 0, 8)], arms=[(90, 0), (80, 150)], cape=4, sprout=-6),
  'c_bow_rel':  dict(hip_h=36, lean=-8, feet=[(19, 0, -6), (-18, 1, 10)], arms=[(92, 0), (-100, 30)], cape=8, sprout=-10),
}
