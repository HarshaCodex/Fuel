package com.lazybuff.fuel;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class FuelApplication {

    public static void main(String[] args) {
        SpringApplication.run(FuelApplication.class, args);
    }
}
