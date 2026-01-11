import { MetronomeCore } from "./MetronomeCore";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock Web Audio API
class MockAudioContext {
    currentTime = 0;
    state = "running";
    resume = vi.fn().mockResolvedValue(undefined);
    createOscillator = vi.fn(() => ({
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
        frequency: {
            setValueAtTime: vi.fn(),
        }
    }));
    createGain = vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        gain: {
            value: 0,
            setValueAtTime: vi.fn(),
            cancelScheduledValues: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
        }
    }));
}

vi.stubGlobal("AudioContext", MockAudioContext);

describe("MetronomeCore", () => {
    let metronome: MetronomeCore;

    beforeEach(() => {
        metronome = new MetronomeCore();
    });

    it("should initialize with default values", () => {
        expect(metronome.bpm).toBe(90);
        expect(metronome.meter).toBe(4);
        expect(metronome.isPlaying).toBe(false);
    });

    it("should set bpm within valid range", () => {
        metronome.bpm = 150;
        expect(metronome.bpm).toBe(150);

        metronome.bpm = 20;
        expect(metronome.bpm).toBe(30); // minBpm

        metronome.bpm = 400;
        expect(metronome.bpm).toBe(300); // maxBpm
    });

    it("should set meter and reset accents", () => {
        metronome.meter = 3;
        expect(metronome.meter).toBe(3);
        expect(metronome.accents).toEqual([true, false, false]);
    });

    it("should start and stop the metronome", async () => {
        await metronome.start();
        expect(metronome.isPlaying).toBe(true);

        metronome.stop();
        expect(metronome.isPlaying).toBe(false);
    });
});
