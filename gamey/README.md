# gamey

This folder contains the Rust implementation of the game engine. 

## Requirements 

In order to compile and run the code, it is necessary to have [cargo](https://doc.rust-lang.org/cargo/) which is part of [Rust](https://rust-lang.org/).

## Build

```sh
cargo build
```

For a release build with optimizations:

```sh
cargo build --release
```

## Run

```sh
cargo run
```

## Test

```sh
cargo test
```

## Benchmarks

Run the benchmarks using Criterion:

```sh
cargo bench
```

## Fuzz Testing

Run fuzz tests using cargo-fuzz (requires nightly Rust):

```sh
cargo install cargo-fuzz
cargo +nightly fuzz run fuzz_yen_deserialize
cargo +nightly fuzz run fuzz_coordinates
```

## Documentation

Generate and open the documentation:

```sh
cargo doc --open
```

## View html testing

Para visualizar la covertura de los test realizados instalamos:

```sh
cargo install cargo-llvm-cov --locked
````

Desde la carpeta gamey:

```sh
# Informe rápido por consola para un módulo específico
cargo llvm-cov --lib cli

# Informe completo para todo el proyecto Rust
cargo llvm-cov

# Generar informe visual en HTML (abre una web detallada)
cargo llvm-cov --html
# Para abrirlo: target/llvm-cov/html/index.html
```