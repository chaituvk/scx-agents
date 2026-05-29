# adp-science

The science package. Pure Python — no web framework, no I/O beyond
parquet/CSV. Everything is importable, everything is testable.

```bash
pip install -e .
adp --help
```

Pipelines (`adp_science.pipelines.*`) are the CLIs. The library
itself is just functions and dataclasses.

See `../../docs/SCIENCE.md` for the modeling deep-dive.
