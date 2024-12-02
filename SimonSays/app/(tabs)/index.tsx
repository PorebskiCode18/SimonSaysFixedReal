import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity,TextInput, Alert,FlatList,} from 'react-native';
import { Accelerometer } from 'expo-sensors';
import { Vibration } from 'react-native';
import {doc , collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, orderBy, onSnapshot } from "firebase/firestore";
import { db, } from "./firebaseConfig";


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
    const [loggedIn, setLoggedIn] = useState<boolean>(false);
    const [isTrick, setIsTrick] = useState<boolean>(false);
    const [holdStartTime, setHoldStartTime] = useState<number | null>(null);
    const [turnsCurrent,setTurnsCurrent] = useState<number | null>(null);
    const [bonusQueue, setBonusQueue] = useState<number[]>([]); // Turns remaining for bonuses
    const [bonusDisplay, setBonusDisplay] = useState<string[]>(['⬤', '⬤', '⬤', '⬤', '⬤']); // Bonus indicator

    const [loginUsername, setLoginUsername] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [signupUsername, setSignupUsername] = useState('');
    const [signupPassword, setSignupPassword] = useState('');

    const [loggedInName, setLoggedInName] = useState<string>('');

    let lastDetectionTime = 0;
    const alpha = 0.8;

    const directionEmojis: { [key in Direction]: string } = {
        UP: '⬆️',
        DOWN: '⬇️',
        LEFT: '⬅️',
        RIGHT: '➡️',
    };

    interface LeaderboardEntry {
        Username: string;
        Highscore: number;
    }
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

    useEffect(() => {
        console.log("Setting up Firestore listener for leaderboard...");
        const leaderboardQuery = query(
            collection(db, 'users'), // Collection name is 'users'
            orderBy('Highscore', 'desc') // Order by Highscore in descending order
        );

        // Real-time listener for Firestore collection
        const unsubscribe = onSnapshot(leaderboardQuery, (querySnapshot) => {
            const leaderboardData: LeaderboardEntry[] = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    Username: data.Username as string,
                    Highscore: data.Highscore as number,
                };
            });

            // Ensure manual sorting as a fallback
            setLeaderboard(
                leaderboardData.sort((a, b) => b.Highscore - a.Highscore)
            );
        });

        // Cleanup listener on component unmount
        return () => unsubscribe();
    }, []);




    useEffect(() => {
        if (isGameActive && timer > 0) {
            const interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
            return () => clearInterval(interval);
        } else if (timer === 0) {
            if (score > highScore) setHighScore(score);
            if (CurrenthighStreak > AllTimehighStreak) setAllTimeHighStreak(CurrenthighStreak)
            updateUserStats(getUserIdByUsername(loggedInName),highScore,AllTimehighStreak)
            setBonusWords('')
            setMultiplier(1)
            setIsGameActive(false);
        }
    }, [isGameActive, timer]);

    const handleDeleteUser = async () => {
        try {
            // Show confirmation prompt
            Alert.alert(
                'Delete Account',
                `Are you sure you want to delete the account of ${loggedInName}?`,
                [
                    {
                        text: 'Cancel',
                        style: 'cancel',
                    },
                    {
                        text: 'Delete',
                        onPress: async () => {
                            try {
                                // Fetch user ID (ensure it resolves before proceeding)
                                const userId = await getUserIdByUsername(loggedInName);
                                if (!userId) {
                                    throw new Error('User ID not found.');
                                }

                                // Delete the user's document from Firestore
                                const userDocRef = doc(db, 'users', userId);
                                await deleteDoc(userDocRef);

                                // After successful deletion, update the state
                                setLoggedIn(false);
                                setLoggedInName('');

                                Alert.alert('Account Deleted', `User ${loggedInName} has been deleted.`);
                            } catch (deleteError) {
                                console.error('Error deleting user:', deleteError);
                                Alert.alert('Error', 'There was an issue deleting the user.');
                            }
                        },
                    },
                ],
            );
        } catch (error) {
            console.error('Error during deletion process:', error);
            Alert.alert('Error', 'There was an issue processing the deletion.');
        }
    };



    const getUserIdByUsername = async (username: unknown) => {
        try {
            const usersCollection = collection(db, "users");
            const q = query(usersCollection, where("Username", "==", username));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const userDoc = querySnapshot.docs[0]; // Get the first matching user document
                return userDoc.id; // Return the document ID
            } else {
                console.error("No user found with the given username.");
                return null;
            }
        } catch (error) {
            console.error("Error fetching user ID:", error);
            return null;
        }
    };


    const updateUserStats = async (
        userId: string | Promise<string | null>,
        newHighscore: number,
        newHighstreak: number
    ): Promise<void> => {
        try {
            // Resolve userId if it's a Promise
            const resolvedUserId = await userId;
            if (!resolvedUserId) {
                throw new Error("User ID is null or undefined.");
            }

            // Reference the user's document in Firestore
            const userDocRef = doc(db, "users", resolvedUserId); // Ensure 'db' is your Firestore instance

            // Update the fields
            await updateDoc(userDocRef, {
                Highscore: newHighscore,
                Highstreak: newHighstreak,
            });
        } catch (error: any) {
            console.error("Error updating user stats:", error.message || error);
            alert(`Error updating user stats. ${error.message || "Please try again."}`);
        }
    };




    useEffect(() => {
        if (isGameActive) {
            generateNewDirection();
            subscribeToAccelerometer();
        } else {
            unsubscribeFromAccelerometer();
        }
        return () => unsubscribeFromAccelerometer();
    }, [isGameActive]);

    const handleLogin = async () => {
        try {
            // Define the Firestore query
            const usersCollectionRef = collection(db, "users");
            const loginQuery = query(
                usersCollectionRef,
                where("Username", "==", loginUsername),
                where("Password", "==", loginPassword)
            );

            // Execute the query
            const querySnapshot = await getDocs(loginQuery);

            // Handle the results
            if (querySnapshot.empty) {
                Alert.alert("Login Failed", "Invalid username or password");
            } else {
                // Access the first document in the query results
                const userDoc = querySnapshot.docs[0]; // Get the first document
                const userData = userDoc.data(); // Extract the data from the document
                const username = userData.Username; // Access the username field
                const userHighscore = userData.Highscore; // Access the highscore field
                const userHighstreak = userData.Highstreak; // Access the highstreak field

                // Update state with user information
                setLoggedInName(username);
                setHighScore(userHighscore);
                setAllTimeHighStreak(userHighstreak);

                // Reset login form fields
                setLoginUsername("");
                setLoginPassword("");

                // Mark the user as logged in
                setLoggedIn(true);
            }
        } catch (error) {
            Alert.alert("Error", "An error occurred while logging in");
            console.error(error);
        }
    };

    const handleSignup = async () => {
        try {
            await addDoc(collection(db, "users"), {
                Highscore: 0,
                Highstreak: 0,
                Password: signupPassword,
                Username: signupUsername,
            });
            setLoggedInName(signupUsername);
            setHighScore(0);
            setCurrentHighStreak(0);
            setAllTimeHighStreak(0);
            alert("Participant added!");
            setSignupUsername("");
            setSignupPassword('');
            setLoggedIn(true);
        } catch (error) {
            Alert.alert('Error', 'An error occurred while creating your account');
            console.error(error);
        }
    };





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
                    if (Math.random()<.5){
                        const num = Math.floor(Math.random()*3)+2;
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
    const logOut= () =>{
        setLoggedInName('')
        setLoggedIn(false);
    }

    return (
        <View style={[styles.container, { backgroundColor }]}>
            {loggedIn && (
                <View style={styles.container}>
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
                        <View style={{ flex: 2, width: '100%' }}>

                            <Text style={styles.loggedInText}>Hello, {loggedInName}</Text>
                            <TouchableOpacity onPress={logOut} style={styles.logoutButton}>
                                <Text style={styles.startButtonText}>Log Out</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleDeleteUser} style={styles.logoutButton}>
                                <Text style={styles.startButtonText}>DELETE USER</Text>
                            </TouchableOpacity>

                            {/* Leaderboard */}
                            <View style={{backgroundColor:'lightgray'}}>
                                <Text style={styles.subtitle}>Leaderboard</Text>

                                {leaderboard.map((entry, index) => (
                                    <Text key={index} style={styles.leaderboardEntry}>
                                        {index + 1}) {entry.Username}: {entry.Highscore}
                                    </Text>
                                ))}
                            </View>


                            <View style={styles.centerContainer}>
                                <TouchableOpacity onPress={startGame} style={styles.startButton}>
                                    <Text style={styles.startButtonText}>Start Game</Text>
                                </TouchableOpacity>
                            </View>
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
            )}
            {!loggedIn && (
                <View style={styles.container}>
                    {/* Login Section */}
                    <View style={styles.loginSection}>
                        <Text style={styles.sectionTitle}>Login</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Username"
                            value={loginUsername}
                            onChangeText={setLoginUsername}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Password"
                            secureTextEntry
                            value={loginPassword}
                            onChangeText={setLoginPassword}
                        />
                        <TouchableOpacity style={styles.button} onPress={handleLogin}>
                            <Text style={styles.buttonText}>Login</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Signup Section */}
                    <View style={styles.signupSection}>
                        <Text style={styles.sectionTitle}>Create Account</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Username"
                            value={signupUsername}
                            onChangeText={(text) => setSignupUsername(text)} // Use onChangeText for direct value updates
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Password"
                            value={signupPassword}
                            onChangeText={(text) => setSignupPassword(text)}
                        />
                        <TouchableOpacity style={styles.button} onPress={handleSignup}>
                            <Text style={styles.buttonText}>Sign Up</Text>
                        </TouchableOpacity>
                    </View>
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
        position: 'relative', // Added to enable absolute positioning for children
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
    loginSection: {
        flex: 1,
        justifyContent: 'center',
    },
    signupSection: {
        flex: 1,
        justifyContent: 'center',
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 20,
    },
    input: {
        height: 50,
        backgroundColor: '#fff',
        borderRadius: 8,
        paddingHorizontal: 15,
        fontSize: 16,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#ccc',
    },
    button: {
        backgroundColor: '#007BFF',
        paddingVertical: 15,
        borderRadius: 8,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    headerContainer: {
        flexDirection: 'row',             // Align elements horizontally (row)
        justifyContent: 'space-between',  // Space out the elements (left and right)
        alignItems: 'center',             // Vertically center items within their container
        width: '100%',                    // Ensure the container spans full width
        height: 60,                       // Set a fixed height for the header (adjust as needed)
        position: 'absolute',             // Keep the header fixed at the top of the screen
        top: 20,                          // Distance from the top of the screen (adjustable)
        paddingLeft: 20,                  // Padding on the left side
        paddingRight: 20,                 // Padding on the right side
        backgroundColor: 'transparent',   // Transparent background
    },

    loggedInText: {
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 0,                    // No extra margin on the left side
    },

    logoutButton: {
        backgroundColor: '#007BFF',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },


    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    leaderboardContainer: {
        marginVertical: 5,
        padding: 5,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
    },
    leaderboardTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 3,
    },
    leaderboardItem: {
        fontSize: 18,
        marginVertical: 3,
    },
    subtitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    leaderboardEntry: {
        fontSize: 16,
        marginVertical: 5,
        backgroundColor: 'gray',
    },
});