---
bump: patch
---
Chart labels in narrow plots: the idle axis parts its minimum and maximum labels when they would print over each other (their tick marks stay on the data; an axis too short for both prints the maximum alone); `Timeline` measures its tick labels and prints every second, third, sixth or twelfth one where neighbours would touch, keeping every tick mark; an annotation label that would cover an earlier annotation's label takes the other side of its anchor.
