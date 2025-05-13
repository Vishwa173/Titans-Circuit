# Titan-s-Circuit

link : https://vishwa173.github.io/Titans-Circuit/home/

Titan's Circuit
Introduction
Sanchit, Revant, and Shreyash were three passionate developers, always eager to build something exciting. One day, they decided to create a strategy game—a battle of intelligence, speed, and tactical moves.

Sanchit, the gameplay architect, designed the hexagonal board, movement mechanics, and scoring system.
Shreyash, the UI/UX expert, made the game visually appealing and mobile-responsive.
Revant, the logic master, implemented timers, power-ups, and a bot opponent.
But building the perfect game is no easy task! Can you help them complete Titan's Circuit? Join their mission and bring this game to life!

Game Setup
Hexagonal Grid: The board consists of three concentric hexagonal circuits:

Outer Circuit (6 nodes)
Middle Circuit (6 nodes)
Inner Circuit (6 nodes)
The edge weight increases as you reach the inner hexagons.
Player Titans: Each player has four Titans (Red and Blue) to place and move on the grid.

Timers:

Overall Timer: Limits the total game duration.
Turn Timer: Limits each player's time per turn.
Game Layout

Gameplay Phases
1. Placement Phase
Players take turns placing their pieces on available nodes in the outermost circuit when starting the game.
Players can either place their remaining titans on the unlocked circuit or move the existing titans.
When the unlocked circuit is fully filled, the inner circuit gets unlocked.
2. Movement Phase
Once all titans are placed, players take turns moving one titan at a time to an adjacent node along connected edges (Titans can only move along the edges).

A titan surrounded by opponent titans is permanently removed from play.

Scoring System
Points are earned by controlling edges:
An edge is controlled when both its connected nodes are occupied by the same player.
Points equal to the edge's weight are added to the player's score.
If a piece moves away from a controlled edge, points equal to that edge's weight are deducted.
Winning Conditions
The game ends when:

The overall timer expires.
The innermost hexagon is fully occupied.
The player with the highest score at the end of the game wins.

Game Modes

Normal Mode

~1.A demo video has been provided- Demo Video~

~2.Create three concentric hexagonal circuits, join the vertices to create edges, and add weights as shown in the demo.~

~3.Implement titan placing logic along with movement logic. Titans can move along the edges to adjacent vertices.~

~4.Implement edge score capturing logic as explained in the demo.~

~5.Add pause, resume, and reset features.~

~6.Make the game mobile responsive.~

~7.Add a time system: Each player gets a specific amount of time. The timer must decrement during the respective player's turn, and there should be a limited time for each move.~

Hacker Mode

~1.Add Undo and Redo buttons.~

~2.Display the history of moves of both players.~

~3.Add in-game sound effects.~

~4.Add smooth animations for piece movements.~

~5.Implement titan elimination: If a player's titan is surrounded by opponent titans on all neighboring sides, it is eliminated.~

~6.Implement a local storage-based leaderboard.~

Hacker++ Mode

~1.Implement Single-player mode.~

~2.Implement replay using history.~

~3.Add Power-Ups (e.g., swap your titan with an opponent's titan, add an extra titan).~

~4.Allow the user to change the shape of the circuit.~

~5.Allow users to add more than three concentric circuits.~

6.Add a Game Review feature that analyzes each move and provides comments on the best possible action for a given situation, similar to Chess.com analysis.
