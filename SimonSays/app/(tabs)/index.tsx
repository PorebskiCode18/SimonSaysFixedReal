import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import { Vibration } from 'react-native';

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

const directions: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];

export default function App() {
    const [currentDirection, setCurrentDirection] = useState<Direction | null>(null);
    const [feedback, setFeedback] = useState<string>('');
    const [subscription, setSubscription] = useState<any>(null);
    const [filteredAccel, setFilteredAccel] = useState({ x: 0, y: 0, z: 0 });
    const [score, setScore] = useState(0);
    const [highScore, setHighScore] = useState<number>(0);
    const [AllTimehighStreak, setAllTimeHighStreak] = useState<number>(0);
    const [CurrenthighStreak, setCurrentHighStreak] = useState<number>(0);
    const [timer, setTimer] = useState<number>(30);
    const [isGameActive, setIsGameActive] = useState(false);
    const [inLobby, setInLobby] = useState<boolean>(true);
    const [multiplier, setMultiplier] = useState<number>(1);
    const [streak, setStreak] = useState(0);
    const [bonusWords, setBonusWords] = useState<string>('');

    const [isTrick, setIsTrick] = useState<boolean>(false);
    const [holdStartTime, setHoldStartTime] = useState<number | null>(null);
    const [turnsCurrent,setTurnsCurrent] = useState<number | null>(null);
    const [bonusQueue, setBonusQueue] = useState<number[]>([]); // Turns remaining for bonuses
    const [bonusDisplay, setBonusDisplay] = useState<string[]>(['⬤', '⬤', '⬤', '⬤', '⬤']); // Bonus indicator

    let lastDetectionTime = 0;
    const alpha = 0.8;

    const directionEmojis: { [key in Direction]: string } = {
        UP: '⬆️',
        DOWN: '⬇️',
        LEFT: '⬅️',
        RIGHT: '➡️',
    };

    useEffect(() => {
        if (isGameActive && timer > 0) {
            const interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
            return () => clearInterval(interval);
        } else if (timer === 0) {
            if (score > highScore) setHighScore(score);
            if (CurrenthighStreak > AllTimehighStreak) setAllTimeHighStreak(CurrenthighStreak)
            setBonusWords('')
            setMultiplier(1)
            setIsGameActive(false);
        }
    }, [isGameActive, timer]);

    useEffect(() => {
        if (isGameActive) {
            generateNewDirection();
            subscribeToAccelerometer();
        } else {
            unsubscribeFromAccelerometer();
        }
        return () => unsubscribeFromAccelerometer();
    }, [isGameActive]);

    const subscribeToAccelerometer = () => {
        setSubscription(
            Accelerometer.addListener(({ x, y, z }) => {
                setFilteredAccel((prev) => ({
                    x: prev.x * alpha + x * (1 - alpha),
                    y: prev.y * alpha + y * (1 - alpha),
                    z: prev.z * alpha + z * (1 - alpha),
                }));
            })
        );
        Accelerometer.setUpdateInterval(100);
    };

    const unsubscribeFromAccelerometer = () => {
        subscription?.remove();
        setSubscription(null);
    };

    const generateNewDirection = () => {
        const newDirection = directions[Math.floor(Math.random() * directions.length)];
        const isSimonSays = Math.random() < 0.75; // 75% chance for normal text
        setIsTrick(!isSimonSays);
        setCurrentDirection(newDirection);
        setFeedback('');
        setHoldStartTime(null); // Reset hold timer for trick text
    };

    const handleNextDirection = (newFeedback: string) => {
        if (newFeedback === 'Correct!') {
            setScore((prev) => prev + multiplier);
            advanceBonusQueue();
            setStreak((prevStreak) => {
                const newStreak = prevStreak + 1;
                if (newStreak > CurrenthighStreak) setCurrentHighStreak(streak);
                // Generate bonus if streak reaches 5 and no current streak below 5
                // @ts-ignore
                if (newStreak >= 5 && turnsCurrent==null && Math.random()<.5) {
                    generateBonus();
                    setBonusWords('')
                }

                return newStreak;
            });
        } else {
            setStreak(0);
            Vibration.vibrate(500);
        }
        setFeedback(newFeedback);
        setCurrentDirection(null);
        setTimeout(() => {
            if (timer > 0) generateNewDirection();
        }, 1000);
    };

    const advanceBonusQueue = () => {
        setBonusQueue((prevQueue) => {
            const updatedQueue = prevQueue.map((turns) => turns - 1).filter((turns) => turns > 0);

            // Update bonus display
            const updatedDisplay = ['⬤', '⬤', '⬤', '⬤', '⬤'];
            updatedQueue.forEach((turns) => {
                if (turns <= 5) updatedDisplay[5 - turns] = '🎁';
                setTurnsCurrent(turns);
                if (turns==1){
                    if (Math.random()<.01){
                        const num = Math.floor(Math.random()*3)+1;
                        setBonusWords(`Score x${num}`);
                        setMultiplier(num)
                        setTurnsCurrent(null)
                    }else{
                        const num = Math.floor(Math.random()*10)+1;
                        setTimer((prevTimer) => prevTimer + num);
                        setBonusWords(`Time +${num}s`);
                        setTurnsCurrent(null)
                    }
                }
            });

            setBonusDisplay(updatedDisplay);

            return updatedQueue;
        });
    };

    const generateBonus = () => {
        setBonusQueue((prevQueue) => {
            if (prevQueue.length < 5) {
                setTurnsCurrent(5);
                return [...prevQueue, 6]; // Always generate for 5 turns away
            }
            return prevQueue;
        });
    };

    const checkDirection = () => {
        if (!isGameActive || !currentDirection) return;

        const now = Date.now();
        if (now - lastDetectionTime < 100) return; // Avoid rapid polling
        lastDetectionTime = now;

        const { x, y, z } = filteredAccel;
        const threshold = 0.6;
        let correct = false;

        if (isTrick) {
            // Trick text logic: hold still for 2 seconds
            if (Math.abs(x) > threshold/2 || Math.abs(z) > threshold/2) {
                handleNextDirection('Incorrect'); // Incorrect if tilted
                setHoldStartTime(null); // Reset hold timer
            } else if (!holdStartTime) {
                setHoldStartTime(now); // Start tracking hold time
            } else if (now - holdStartTime >= 2000) {
                correct = true; // Held still for 2 seconds
                setHoldStartTime(null); // Reset hold timer for next round

                // Add 5 seconds to the timer when the trick is correct
                setTimer((prevTimer) => prevTimer + 2);
            }
        } else {
            // Normal Simon Says logic
            let isCorrectTilt = false;
            let isWrongTilt = false;

            switch (currentDirection) {
                case 'UP':
                    isCorrectTilt = z > threshold;
                    isWrongTilt = z < -threshold || Math.abs(x) > threshold;
                    break;
                case 'DOWN':
                    isCorrectTilt = z < -threshold;
                    isWrongTilt = z > threshold || Math.abs(x) > threshold;
                    break;
                case 'LEFT':
                    isCorrectTilt = x > threshold;
                    isWrongTilt = x < -threshold || Math.abs(z) > threshold;
                    break;
                case 'RIGHT':
                    isCorrectTilt = x < -threshold;
                    isWrongTilt = x > threshold || Math.abs(z) > threshold;
                    break;
            }

            if (isCorrectTilt) {
                correct = true; // Correct tilt detected
                setHoldStartTime(null); // Reset hold timer for next round
            } else if (isWrongTilt) {
                handleNextDirection('Incorrect'); // Incorrect if wrong tilt detected
                setHoldStartTime(null); // Reset hold timer
            } else if (!holdStartTime) {
                setHoldStartTime(now); // Start tracking if no tilt detected yet
            } else if (now - holdStartTime >= 2000) {
                handleNextDirection('Didn’t Tilt'); // Show "Didn’t Tilt" if no tilt within 2 seconds
                setHoldStartTime(null); // Reset hold timer
            }
        }

        if (correct) {
            handleNextDirection('Correct!');
        }
    };

    useEffect(() => {
        checkDirection();
    }, [filteredAccel]);

    const backgroundColor =
        feedback === 'Correct!' ? '#90EE90' : feedback === 'Incorrect' ? '#FFCCCB' : feedback === "Didn’t Tilt" ? '#FFCCCB' : 'white';

    const startGame = () => {
        setIsGameActive(true);
        setScore(0);
        setStreak(0);
        setCurrentHighStreak(0)
        setTimer(30);
        setTurnsCurrent(null);
        setBonusQueue([]);
        setBonusDisplay(['⬤', '⬤', '⬤', '⬤', '⬤']);
        generateNewDirection();
        setInLobby(false);
    };
    const returnLobby = () =>{
        setInLobby(true);
    }

    return (
        <View style={[styles.container, { backgroundColor }]}>
            <Text style={styles.feedback}>{feedback}</Text>
            {isGameActive && (
                <View style={styles.bonusContainer}>
                    {bonusDisplay.map((symbol, index) => (
                        <Text key={index} style={styles.bonusSymbol}>
                            {symbol}
                        </Text>
                    ))}
                </View>
            )}
            {isGameActive && timer > 0 && currentDirection && (
                <View style={styles.directionContainer}>
                    <Text style={styles.directionEmoji}>
                        {directionEmojis[currentDirection]}
                    </Text>
                    <Text style={styles.directionText}>
                        {isTrick ? `Tilt ${currentDirection}` : `Simon says: tilt ${currentDirection}`}
                    </Text>
                </View>
            )}
            {!inLobby && (
                <View style={styles.timeContainer}>
                    <Text style={styles.timer}>Time: {timer}s</Text>
                </View>
            )}
            {!inLobby && (
                <View style={styles.timerScoreContainer}>
                    <Text style={styles.score}>Score: {score}</Text>
                    <Text style={styles.streak}>Streak: {streak}</Text>
                </View>
            )}
            <Text style={styles.bonusText}>{bonusWords}</Text>

            {!inLobby && !isGameActive && timer === 0 && (
                <View>
                    <Text style={styles.feedback}>
                        Game Over!
                    </Text>
                    <Text style={styles.feedback}>
                        Score: {score}
                    </Text>
                    <Text style={styles.feedback}>
                        Highest Streak: {CurrenthighStreak}
                    </Text>
                    <TouchableOpacity onPress={returnLobby} style={styles.startButton}>
                        <Text style={styles.startButtonText}>Return to Lobby</Text>
                    </TouchableOpacity>
                </View>
            )}
            {inLobby && !isGameActive && (
                <View>
                    <TouchableOpacity onPress={startGame} style={styles.startButton}>
                        <Text style={styles.startButtonText}>Start Game</Text>
                    </TouchableOpacity>
                </View>
            )}
            {inLobby && !isGameActive && (
                <View>
                    <Text style={styles.feedback}>
                        High Score: {highScore}
                    </Text>
                    <Text style={styles.feedback}>
                        Highest Streak: {AllTimehighStreak}
                    </Text>
                    <Text style={styles.feedback}>
                        Last Streak: {CurrenthighStreak}
                    </Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    feedback: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    bonusContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 20,
    },
    bonusSymbol: {
        fontSize: 30,
        marginHorizontal: 5,
    },
    directionContainer: {
        alignItems: 'center',
        marginBottom: 30,
    },
    directionEmoji: {
        fontSize: 80,
    },
    directionText: {
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 10,
    },
    timeContainer: {
        position: 'absolute',
        top: 50,
        left: 20,
    },
    timer: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    timerScoreContainer: {
        position: 'absolute',
        top: 50,
        right: 20,
        alignItems: 'flex-end',
    },
    score: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    streak: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    startButton: {
        backgroundColor: '#007BFF',
        paddingVertical: 15,
        paddingHorizontal: 30,
        borderRadius: 10,
        textAlign: 'center',
    },
    startButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        alignItems: 'center',
    },
    bonusText: {
        color: 'golden',
        fontSize: 18,
        fontWeight: 'bold',
        verticalAlign: 'bottom',
    },
});