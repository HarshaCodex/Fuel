package com.lazybuff.fuel.config;

import com.lazybuff.fuel.logging.MdcTaskDecorator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean(name = "emailTaskExecutor")
    public TaskExecutor emailTaskExecutor() {

        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();

        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(10);
        executor.setQueueCapacity(100);

        executor.setThreadNamePrefix("email-");
        // Email logs keep the request ID of the request that triggered them (#108).
        executor.setTaskDecorator(new MdcTaskDecorator());

        executor.initialize();

        return executor;
    }
}
